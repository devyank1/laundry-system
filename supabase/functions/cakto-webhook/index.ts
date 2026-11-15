// POST /functions/v1/cakto-webhook — compra aprovada na Cakto vira conta de
// cliente físico. Público (verify_jwt = false no config.toml): quem garante
// a origem é a assinatura HMAC, checada antes de qualquer escrita.
import { createSupabaseAdminClient, requireEnv } from "../_shared/supabaseAdmin.ts";
import { logAdminAction } from "../_shared/auditLog.ts";
import { createInviteLink, createRecoveryLink, EmailAlreadyRegisteredError, sendSetPasswordEmail } from "../_shared/invite.ts";
import { handleCaktoWebhook } from "./handler.ts";

const INTRO = "Sua compra foi aprovada! Defina sua senha para começar a montar a planta da sua lavanderia.";

Deno.serve((req) => {
  const admin = createSupabaseAdminClient();
  return handleCaktoWebhook(req, {
    secret: requireEnv("CAKTO_WEBHOOK_SECRET"),
    productIds: requireEnv("CAKTO_PRODUCT_ID").split(",").map((id) => id.trim()).filter(Boolean),
    now: () => Math.floor(Date.now() / 1000),

    claimEvent: async (eventId) => {
      const { error } = await admin.from("cakto_processed_events").insert({ event_id: eventId });
      if (!error) return true;
      if (error.code === "23505") return false; // unique_violation: já processado
      throw new Error(`claimEvent falhou: ${error.code}`);
    },

    releaseEvent: async (eventId) => {
      await admin.from("cakto_processed_events").delete().eq("event_id", eventId);
    },

    provisionClienteFisico: async (email) => {
      let link: { userId: string; url: string };
      try {
        link = await createInviteLink(admin, email);
      } catch (err) {
        if (!(err instanceof EmailAlreadyRegisteredError)) throw err;
        // Já existe no Auth (ex.: tentativa anterior que falhou no email).
        link = await createRecoveryLink(admin, email);
        const { data: existing } = await admin.from("profiles").select("id").eq("id", link.userId).maybeSingle();
        // Já tem papel (empresa, admin ou cliente): não rebaixa nem reenvia.
        if (existing) return { created: false };
      }
      const { error } = await admin
        .from("profiles")
        .upsert({ id: link.userId, email, role: "cliente_fisico", company_id: null, is_owner: false, active: true }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(`profiles insert falhou: ${error.code}`);
      await sendSetPasswordEmail(email, link.url, INTRO);
      return { created: true };
    },

    log: (action, details) => logAdminAction({ admin, actorId: null, action, details }),
  });
});
