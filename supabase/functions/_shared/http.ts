import type { SupabaseClient } from "./supabaseAdmin.ts";

const ALLOWED_ORIGIN = Deno.env.get("APP_PUBLIC_URL") ?? "";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

// Resposta pro navegador: só mensagem amigável, nunca detalhe interno.
export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export interface Caller {
  id: string;
  role: "admin" | "empresa" | "cliente_fisico";
  companyId: string | null;
  isOwner: boolean;
}

// Reconfirma no servidor quem está chamando (JWT do header Authorization) e
// o papel atual dele em profiles — nunca confia no que a UI diz.
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

export { normalizeEmail } from "./validation.ts";
