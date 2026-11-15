// POST /functions/v1/cakto-webhook — compra aprovada na Cakto vira conta de
// cliente físico. Público (verify_jwt = false no config.toml): quem garante
// a origem é a assinatura HMAC, checada antes de qualquer escrita.
import { createSupabaseAdminClient, requireEnv } from "../_shared/supabaseAdmin.ts";
import { logAdminAction } from "../_shared/auditLog.ts";
import { createInviteLink, createRecoveryLink, findAuthUserIdByEmail, sendSetPasswordEmail } from "../_shared/invite.ts";
import { provisionClienteFisico } from "./provision.ts";
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

    provisionClienteFisico: (email) =>
      provisionClienteFisico(email, {
        findUserId: (e) => findAuthUserIdByEmail(admin, e),
        createInviteLink: (e) => createInviteLink(admin, e),
        createRecoveryLink: (e) => createRecoveryLink(admin, e),
        getRole: async (id) => {
          const { data, error } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
          if (error) throw new Error(`profiles lookup falhou: ${error.code}`);
          return (data?.role as string | undefined) ?? null;
        },
        hasSignedIn: async (id) => {
          const { data, error } = await admin.auth.admin.getUserById(id);
          if (error) throw new Error(`getUserById falhou: ${error.code ?? error.status}`);
          return Boolean(data.user?.last_sign_in_at);
        },
        insertProfile: async (id, e) => {
          const { error } = await admin
            .from("profiles")
            .insert({ id, email: e, role: "cliente_fisico", company_id: null, is_owner: false, active: true });
          if (error) throw new Error(`profiles insert falhou: ${error.code}`);
        },
        sendEmail: (e, url) => sendSetPasswordEmail(e, url, INTRO),
        deleteUser: async (id) => {
          await admin.auth.admin.deleteUser(id);
        },
      }),

    log: (action, details) => logAdminAction({ admin, actorId: null, action, details }),
  });
});
