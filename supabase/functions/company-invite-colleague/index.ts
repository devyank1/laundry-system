// POST /functions/v1/company-invite-colleague — só o dono da empresa.
import { createSupabaseAdminClient, requireEnv } from "../_shared/supabaseAdmin.ts";
import { getCaller } from "../_shared/http.ts";
import { logAdminAction } from "../_shared/auditLog.ts";
import { createInviteLink, sendSetPasswordEmail } from "../_shared/invite.ts";
import { handleInviteColleague } from "./handler.ts";

Deno.serve((req) => {
  const admin = createSupabaseAdminClient();
  return handleInviteColleague(req, {
    allowedOrigin: requireEnv("APP_PUBLIC_URL"),
    getCaller: (r) => getCaller(admin, r),

    inviteColleague: async ({ email, companyId }) => {
      const link = await createInviteLink(admin, email);
      try {
        const { data: company } = await admin.from("companies").select("name").eq("id", companyId).single();
        const { error } = await admin
          .from("profiles")
          .insert({ id: link.userId, email, role: "empresa", company_id: companyId, is_owner: false, active: true });
        if (error) throw new Error(`profiles insert falhou: ${error.code}`);
        await sendSetPasswordEmail(
          email,
          link.url,
          `Você foi convidado para a equipe da ${company?.name ?? "sua empresa"} no Configurador de Lavanderia. Defina sua senha para entrar.`,
        );
        return { userId: link.userId };
      } catch (err) {
        // Usuário acabou de ser criado por este convite: desfaz (cascata no perfil).
        await admin.auth.admin.deleteUser(link.userId);
        throw err;
      }
    },

    log: (actorId, action, details) => logAdminAction({ admin, actorId, action, details }),
  });
});
