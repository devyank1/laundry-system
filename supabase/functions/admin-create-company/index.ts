// POST /functions/v1/admin-create-company — só admin (reconfirmado aqui).
import { createSupabaseAdminClient, requireEnv } from "../_shared/supabaseAdmin.ts";
import { getCaller } from "../_shared/http.ts";
import { logAdminAction } from "../_shared/auditLog.ts";
import { createInviteLink, sendSetPasswordEmail } from "../_shared/invite.ts";
import { handleCreateCompany } from "./handler.ts";

Deno.serve((req) => {
  const admin = createSupabaseAdminClient();
  return handleCreateCompany(req, {
    allowedOrigin: requireEnv("APP_PUBLIC_URL"),
    getCaller: (r) => getCaller(admin, r),

    knownMachineIds: async (ids) => {
      const { data, error } = await admin.from("catalog_machines").select("id").in("id", ids);
      if (error) throw new Error(`catalog lookup falhou: ${error.code}`);
      return (data ?? []).map((row: { id: string }) => row.id);
    },

    createCompanyWithOwner: async ({ name, machineIds, ownerEmail }) => {
      // Usuário primeiro: email já cadastrado barra antes de criar a empresa.
      const link = await createInviteLink(admin, ownerEmail);
      let companyId: string | null = null;
      try {
        const { data: company, error: companyError } = await admin.from("companies").insert({ name }).select("id").single();
        if (companyError || !company) throw new Error(`companies insert falhou: ${companyError?.code}`);
        companyId = company.id as string;

        const { error: machinesError } = await admin
          .from("company_machines")
          .insert(machineIds.map((id) => ({ company_id: companyId, catalog_machine_id: id })));
        if (machinesError) throw new Error(`company_machines insert falhou: ${machinesError.code}`);

        const { error: profileError } = await admin
          .from("profiles")
          .insert({ id: link.userId, email: ownerEmail, role: "empresa", company_id: companyId, is_owner: true, active: true });
        if (profileError) throw new Error(`profiles insert falhou: ${profileError.code}`);

        await sendSetPasswordEmail(
          ownerEmail,
          link.url,
          `Você foi cadastrado como responsável pela empresa ${name} no Configurador de Lavanderia. Defina sua senha para entrar.`,
        );
        return { companyId };
      } catch (err) {
        // Desfaz tudo: sem empresa pela metade nem usuário órfão.
        if (companyId) await admin.from("companies").delete().eq("id", companyId);
        await admin.auth.admin.deleteUser(link.userId);
        throw err;
      }
    },

    log: (actorId, action, details) => logAdminAction({ admin, actorId, action, details }),
  });
});
