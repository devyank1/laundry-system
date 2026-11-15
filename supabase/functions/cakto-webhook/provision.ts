// Provisionamento do cliente físico (puro; index.ts liga as dependências).
// Regra de ouro: quem pagou sempre acaba com um link de acesso, e conta de
// outra pessoa (empresa/admin) nunca muda de papel nem perde link pendente.

export interface ProvisionDeps {
  findUserId: (email: string) => Promise<string | null>;
  createInviteLink: (email: string) => Promise<{ userId: string; url: string }>;
  createRecoveryLink: (email: string) => Promise<{ userId: string; url: string }>;
  getRole: (userId: string) => Promise<string | null>;
  hasSignedIn: (userId: string) => Promise<boolean>;
  insertProfile: (userId: string, email: string) => Promise<void>;
  sendEmail: (email: string, url: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

export async function provisionClienteFisico(email: string, deps: ProvisionDeps): Promise<{ created: boolean }> {
  const existingId = await deps.findUserId(email);

  if (!existingId) {
    const link = await deps.createInviteLink(email);
    try {
      await deps.insertProfile(link.userId, email);
      await deps.sendEmail(email, link.url);
      return { created: true };
    } catch (err) {
      // Desfaz tudo: o reenvio manual pela Cakto volta a cair aqui como novo.
      await deps.deleteUser(link.userId);
      throw err;
    }
  }

  const role = await deps.getRole(existingId);
  if (role && role !== "cliente_fisico") return { created: false };
  if (role === "cliente_fisico" && (await deps.hasSignedIn(existingId))) return { created: false };

  // Sem perfil, ou cliente que ainda não entrou: (re)entrega o acesso.
  const link = await deps.createRecoveryLink(email);
  if (!role) await deps.insertProfile(existingId, email);
  await deps.sendEmail(email, link.url);
  return { created: !role };
}
