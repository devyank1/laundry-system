// POST /functions/v1/company-revoke-member — só o dono da empresa.
import { createSupabaseAdminClient, requireEnv } from "../_shared/supabaseAdmin.ts";
import { getCaller } from "../_shared/http.ts";
import { logAdminAction } from "../_shared/auditLog.ts";
import { handleRevokeMember } from "./handler.ts";

Deno.serve((req) => {
  const admin = createSupabaseAdminClient();
  return handleRevokeMember(req, {
    allowedOrigin: requireEnv("APP_PUBLIC_URL"),
    getCaller: (r) => getCaller(admin, r),

    deactivateColleague: async ({ userId, companyId }) => {
      // Nunca sai da própria empresa e nunca atinge o dono.
      const { data: target, error: findError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .eq("company_id", companyId)
        .eq("role", "empresa")
        .eq("is_owner", false)
        .eq("active", true)
        .maybeSingle();
      if (findError) throw new Error(`profiles select falhou: ${findError.code}`);
      if (!target) return "not_found";

      // Convite nunca aceito: apaga o usuário (o perfil vai junto).
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      if (authUser?.user && !authUser.user.last_sign_in_at) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) throw new Error(`deleteUser falhou: ${deleteError.code}`);
        return "removed";
      }

      const { error } = await admin.from("profiles").update({ active: false }).eq("id", userId).eq("company_id", companyId);
      if (error) throw new Error(`profiles update falhou: ${error.code}`);
      // Bloqueia novo login e renovação de sessão no Auth (a RLS já nega as
      // leituras da sessão que ainda estiver aberta).
      const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (banError) console.error("ban after revoke failed", { code: banError.code });
      return "revoked";
    },

    log: (actorId, action, details) => logAdminAction({ admin, actorId, action, details }),
  });
});
