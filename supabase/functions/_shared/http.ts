// Utilitários HTTP das functions chamadas pelo navegador. Sem Deno.env aqui
// (fica testável no vitest): a origem permitida vem de quem chama.
import type { SupabaseClient } from "./supabaseAdmin.ts";
import { jwtAal, jwtSessionId } from "./jwt.ts";

export { normalizeEmail } from "./validation.ts";

export function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// Resposta pro navegador: só mensagem amigável em { error }, nunca detalhe interno.
export function json(status: number, body: Record<string, unknown>, allowedOrigin: string): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(allowedOrigin), "Content-Type": "application/json" } });
}

export interface Caller {
  id: string;
  role: "admin" | "empresa";
  companyId: string | null;
  isOwner: boolean;
}

// Reconfirma no servidor quem está chamando (JWT do header Authorization) e
// o papel atual em profiles — nunca confia no que a UI diz. Inativo, empresa
// sem cadastro completo ou token de aparelho derrubado = null.
export async function getCaller(admin: SupabaseClient, req: Request): Promise<Caller | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("id, role, company_id, is_owner, active, registration_completed_at")
    .eq("id", userData.user.id)
    .single();
  if (error || !data || !data.active) return null;
  // Admin só age depois do código do celular (aal2), igual à RLS.
  if (data.role === "admin" && jwtAal(token) !== "aal2") return null;
  // Conta de empresa só age depois do cadastro completo (igual à RLS).
  if (data.role === "empresa" && !data.registration_completed_at) return null;
  const sessionId = jwtSessionId(token);
  const { data: current } = await admin.from("user_sessions").select("session_id").eq("user_id", data.id).maybeSingle();
  if (!sessionId || !current || current.session_id !== sessionId) return null;
  return { id: data.id, role: data.role, companyId: data.company_id, isOwner: data.is_owner };
}
