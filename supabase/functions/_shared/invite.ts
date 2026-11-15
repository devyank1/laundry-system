import { requireEnv, type SupabaseClient } from "./supabaseAdmin.ts";
import { sendBrandedEmail } from "./resend.ts";

export class EmailAlreadyRegisteredError extends Error {}

// Monta o link no formato que a SetPasswordPage verifica (token_hash +
// verifyOtp). generateLink não manda email: quem manda é o Resend.
function setPasswordUrl(tokenHash: string, type: "invite" | "recovery"): string {
  const base = requireEnv("APP_PUBLIC_URL").replace(/\/+$/, "");
  return `${base}/set-password?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;
}

function isAlreadyRegistered(error: { code?: string; message?: string; status?: number }): boolean {
  return error.code === "email_exists" || error.status === 422 || /already been registered/i.test(error.message ?? "");
}

// Cria o usuário no Supabase Auth (sem senha) e manda o convite de marca.
export async function inviteNewUser(admin: SupabaseClient, email: string, intro: string): Promise<{ userId: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
  if (error) {
    if (isAlreadyRegistered(error)) throw new EmailAlreadyRegisteredError();
    throw new Error(`generateLink(invite) falhou: ${error.code ?? error.status}`);
  }
  await sendBrandedEmail({
    to: email,
    subject: "Seu acesso ao Configurador de Lavanderia",
    heading: "Defina sua senha",
    intro,
    actionUrl: setPasswordUrl(data.properties.hashed_token, "invite"),
    actionLabel: "Definir minha senha",
  });
  return { userId: data.user.id };
}

// Usuário que já existe recebe um link de redefinição (nunca uma senha).
export async function sendSetPasswordLink(admin: SupabaseClient, email: string, intro: string): Promise<{ userId: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw new Error(`generateLink(recovery) falhou: ${error.code ?? error.status}`);
  await sendBrandedEmail({
    to: email,
    subject: "Seu acesso ao Configurador de Lavanderia",
    heading: "Acesse sua conta",
    intro,
    actionUrl: setPasswordUrl(data.properties.hashed_token, "recovery"),
    actionLabel: "Definir senha e entrar",
  });
  return { userId: data.user.id };
}
