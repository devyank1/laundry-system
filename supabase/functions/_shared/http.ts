// Utilitários HTTP das functions chamadas pelo navegador. Sem Deno.env aqui
// (fica testável no vitest): a origem permitida vem de quem chama.
import type { SupabaseClient } from "./supabaseAdmin.ts";

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
  role: "admin" | "empresa" | "cliente_fisico";
  companyId: string | null;
  isOwner: boolean;
}

// Reconfirma no servidor quem está chamando (JWT do header Authorization) e
// o papel atual em profiles — nunca confia no que a UI diz. Inativo = null.
export async function getCaller(admin: SupabaseClient, req: Request): Promise<Caller | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("id, role, company_id, is_owner, active")
    .eq("id", userData.user.id)
    .single();
  if (error || !data || !data.active) return null;
  return { id: data.id, role: data.role, companyId: data.company_id, isOwner: data.is_owner };
}
