import { requireEnv, type SupabaseClient } from "./supabaseAdmin.ts";
import { sendBrandedEmail } from "./resend.ts";

export class EmailAlreadyRegisteredError extends Error {}

type LinkType = "invite" | "recovery";

// Link no formato que a SetPasswordPage verifica (token_hash + verifyOtp).
// generateLink não manda email nenhum: quem manda é sendSetPasswordEmail.
function setPasswordUrl(tokenHash: string, type: LinkType): string {
  const base = requireEnv("APP_PUBLIC_URL").replace(/\/+$/, "");
  return `${base}/set-password?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;
}

function isAlreadyRegistered(error: { code?: string; message?: string; status?: number }): boolean {
  return error.code === "email_exists" || /already been registered/i.test(error.message ?? "");
}

// Cria o usuário (sem senha) e devolve o link de convite de uso único.
export async function createInviteLink(admin: SupabaseClient, email: string): Promise<{ userId: string; url: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
  if (error) {
    if (isAlreadyRegistered(error)) throw new EmailAlreadyRegisteredError();
    throw new Error(`generateLink(invite) falhou: ${error.code ?? error.status}`);
  }
  return { userId: data.user.id, url: setPasswordUrl(data.properties.hashed_token, "invite") };
}

// Pra quem já existe no Auth: link de "definir nova senha" (nunca uma senha).
export async function createRecoveryLink(admin: SupabaseClient, email: string): Promise<{ userId: string; url: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw new Error(`generateLink(recovery) falhou: ${error.code ?? error.status}`);
  return { userId: data.user.id, url: setPasswordUrl(data.properties.hashed_token, "recovery") };
}

export async function sendSetPasswordEmail(email: string, url: string, intro: string): Promise<void> {
  await sendBrandedEmail({
    to: email,
    subject: "Seu acesso ao Configurador de Lavanderia",
    heading: "Defina sua senha",
    intro,
    actionUrl: url,
    actionLabel: "Definir minha senha",
  });
}
