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
      const { data, error } = await admin
        .from("profiles")
        .update({ active: false })
        .eq("id", userId)
        .eq("company_id", companyId)
        .eq("role", "empresa")
        .eq("is_owner", false)
        .select("id");
      if (error) throw new Error(`profiles update falhou: ${error.code}`);
      if (!data || data.length === 0) return false;
      // Bloqueia novo login e renovação de sessão no Auth (a RLS já nega as
      // leituras da sessão que ainda estiver aberta).
      const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (banError) console.error("ban after revoke failed", { code: banError.code });
      return true;
    },

    log: (actorId, action, details) => logAdminAction({ admin, actorId, action, details }),
  });
});
