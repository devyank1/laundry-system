// ADMIN convida outro admin: a pessoa recebe email, define a senha e já entra
// como admin. Papel reconfirmado aqui no servidor.
import { json, normalizeEmail, type Caller } from "../_shared/http.ts";
import { EmailAlreadyRegisteredError } from "../_shared/errors.ts";

export interface InviteAdminDeps {
  allowedOrigin: string;
  getCaller: (req: Request) => Promise<Caller | null>;
  // Lança EmailAlreadyRegisteredError quando o email já tem perfil no app.
  inviteAdmin: (input: { email: string }) => Promise<{ userId: string; reusedAccount: boolean }>;
  log: (actorId: string, action: string, details: Record<string, unknown>) => Promise<void>;
}

export async function handleInviteAdmin(req: Request, deps: InviteAdminDeps): Promise<Response> {
  const reply = (status: number, body: Record<string, unknown>) => json(status, body, deps.allowedOrigin);
  if (req.method === "OPTIONS") return reply(200, {});
  if (req.method !== "POST") return reply(405, { error: "Método não permitido." });

  const caller = await deps.getCaller(req);
  if (!caller) return reply(401, { error: "Sua sessão expirou. Entre novamente." });
  if (caller.role !== "admin") return reply(403, { error: "Sem permissão para convidar administradores." });

  let body: { email?: unknown } | null;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = null;
  }
  const email = normalizeEmail(body?.email);
  if (!email) return reply(400, { error: "Informe um email válido." });

  try {
    const { userId, reusedAccount } = await deps.inviteAdmin({ email });
    await deps.log(caller.id, "admin_invited", { invitedUserId: userId, email, reusedAccount });
    return reply(200, { userId });
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return reply(409, { error: "Este email já tem cadastro no configurador (como admin, empresa ou cliente)." });
    }
    console.error("admin-invite-admin failed", { reason: err instanceof Error ? err.message : "unknown" });
    return reply(500, { error: "Não foi possível enviar o convite. Tente novamente." });
  }
}
