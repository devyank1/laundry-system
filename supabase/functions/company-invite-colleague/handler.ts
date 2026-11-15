// Dono da empresa convida um colega (mesma empresa, mesmo catálogo).
import { json, normalizeEmail, type Caller } from "../_shared/http.ts";
import { EmailAlreadyRegisteredError } from "../_shared/errors.ts";
import { readJson, requireCompanyOwner } from "../_shared/ownerGuard.ts";

export interface InviteColleagueDeps {
  allowedOrigin: string;
  getCaller: (req: Request) => Promise<Caller | null>;
  inviteColleague: (input: { email: string; companyId: string }) => Promise<{ userId: string }>;
  log: (actorId: string, action: string, details: Record<string, unknown>) => Promise<void>;
}

export async function handleInviteColleague(req: Request, deps: InviteColleagueDeps): Promise<Response> {
  const owner = await requireCompanyOwner(req, deps.allowedOrigin, deps.getCaller);
  if (owner instanceof Response) return owner;
  const reply = (status: number, body: Record<string, unknown>) => json(status, body, deps.allowedOrigin);

  const email = normalizeEmail((await readJson(req))?.email);
  if (!email) return reply(400, { error: "Informe um email válido." });

  try {
    const { userId } = await deps.inviteColleague({ email, companyId: owner.companyId });
    await deps.log(owner.id, "colleague_invited", { companyId: owner.companyId, userId, email });
    return reply(200, { ok: true });
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return reply(409, { error: "Este email já tem cadastro no configurador." });
    }
    console.error("company-invite-colleague failed", { reason: err instanceof Error ? err.message : "unknown" });
    return reply(500, { error: "Não foi possível enviar o convite. Tente novamente." });
  }
}
