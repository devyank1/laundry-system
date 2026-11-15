import { requireEnv } from "./supabaseAdmin.ts";
import { brandedEmailHtml } from "./emailTemplate.ts";

type EmailParams = { to: string; subject: string; heading: string; intro: string; actionUrl: string; actionLabel: string };

// Só em desenvolvimento local: com MAILPIT_SEND_URL definido o email cai no
// Mailpit do `supabase start` (http://127.0.0.1:54324) em vez do Resend.
async function sendViaMailpit(url: string, params: EmailParams): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: requireEnv("EMAIL_FROM") },
      To: [{ Email: params.to }],
      Subject: params.subject,
      HTML: brandedEmailHtml(params),
    }),
  });
  if (!response.ok) throw new Error(`Mailpit respondeu ${response.status}`);
}

export async function sendBrandedEmail(params: EmailParams): Promise<void> {
  const mailpit = Deno.env.get("MAILPIT_SEND_URL");
  if (mailpit) return sendViaMailpit(mailpit, params);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: requireEnv("EMAIL_FROM"),
      to: [params.to],
      subject: params.subject,
      html: brandedEmailHtml(params),
    }),
  });
  if (!response.ok) {
    // Status só; o corpo da resposta pode ecoar o email do destinatário.
    throw new Error(`Resend respondeu ${response.status}`);
  }
}
