// POST /functions/v1/admin-invite-admin — só admin (reconfirmado aqui).
import { createSupabaseAdminClient, requireEnv } from "../_shared/supabaseAdmin.ts";
import { getCaller } from "../_shared/http.ts";
import { logAdminAction } from "../_shared/auditLog.ts";
import {
  EmailAlreadyRegisteredError,
  createInviteLink,
  createRecoveryLink,
  findAuthUserIdByEmail,
  sendSetPasswordEmail,
} from "../_shared/invite.ts";
import { handleInviteAdmin } from "./handler.ts";

const INTRO = "Você foi convidado como administrador do Configurador de Lavanderia. Defina sua senha para entrar.";

Deno.serve((req) => {
  const admin = createSupabaseAdminClient();

  async function insertAdminProfile(userId: string, email: string): Promise<void> {
    const { error } = await admin
      .from("profiles")
      .insert({ id: userId, email, role: "admin", company_id: null, is_owner: false, active: true });
    if (error?.code === "23505") throw new EmailAlreadyRegisteredError();
    if (error) throw new Error(`profiles insert falhou: ${error.code}`);
  }

  return handleInviteAdmin(req, {
    allowedOrigin: requireEnv("APP_PUBLIC_URL"),
    getCaller: (r) => getCaller(admin, r),

    inviteAdmin: async ({ email }) => {
      const existingId = await findAuthUserIdByEmail(admin, email);

      if (existingId) {
        // Conta no Auth sem perfil (ex.: convite feito pelo painel do Supabase):
        // não é de ninguém no app, vira admin. Com perfil, nunca mexe.
        const { data: profile, error } = await admin.from("profiles").select("id").eq("id", existingId).maybeSingle();
        if (error) throw new Error(`profiles lookup falhou: ${error.code}`);
        if (profile) throw new EmailAlreadyRegisteredError();
        const link = await createRecoveryLink(admin, email);
        await insertAdminProfile(existingId, email);
        try {
          await sendSetPasswordEmail(email, link.url, INTRO);
        } catch (err) {
          // Tira só o perfil que acabamos de pôr; a conta continua intacta.
          await admin.from("profiles").delete().eq("id", existingId).eq("role", "admin");
          throw err;
        }
        return { userId: existingId, reusedAccount: true };
      }

      const link = await createInviteLink(admin, email);
      try {
        await insertAdminProfile(link.userId, email);
        await sendSetPasswordEmail(email, link.url, INTRO);
        return { userId: link.userId, reusedAccount: false };
      } catch (err) {
        // Usuário criado agora por este convite: desfaz (perfil cai em cascata).
        await admin.auth.admin.deleteUser(link.userId);
        throw err;
      }
    },

    log: (actorId, action, details) => logAdminAction({ admin, actorId, action, details }),
  });
});
