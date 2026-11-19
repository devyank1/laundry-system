// Dono da empresa revoga o acesso de um colega. A RLS (current_profile com
// active = true) corta as leituras dele na hora, mesmo com sessão aberta.
import { json, type Caller } from "../_shared/http.ts";
import { readJson, requireCompanyOwner } from "../_shared/ownerGuard.ts";

export interface RevokeMemberDeps {
  allowedOrigin: string;
  getCaller: (req: Request) => Promise<Caller | null>;
  // "revoked": desativou e baniu; "removed": convite nunca aceito, usuário
  // apagado; "not_found": não é colega (não-dono) dessa empresa.
  deactivateColleague: (input: { userId: string; companyId: string }) => Promise<"revoked" | "removed" | "not_found">;
  log: (actorId: string, action: string, details: Record<string, unknown>) => Promise<void>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleRevokeMember(req: Request, deps: RevokeMemberDeps): Promise<Response> {
  const owner = await requireCompanyOwner(req, deps.allowedOrigin, deps.getCaller);
  if (owner instanceof Response) return owner;
  const reply = (status: number, body: Record<string, unknown>) => json(status, body, deps.allowedOrigin);

  const userId = (await readJson(req))?.userId;
  if (userId === owner.id) return reply(400, { error: "Você não pode revogar o próprio acesso." });
  if (typeof userId !== "string" || !UUID_RE.test(userId)) return reply(400, { error: "Colega inválido." });

  try {
    const result = await deps.deactivateColleague({ userId, companyId: owner.companyId });
    if (result === "not_found") return reply(404, { error: "Colega não encontrado na sua empresa." });
    const action = result === "removed" ? "colleague_invite_cancelled" : "colleague_revoked";
    await deps.log(owner.id, action, { companyId: owner.companyId, userId });
    return reply(200, { result });
  } catch (err) {
    console.error("company-revoke-member failed", { reason: err instanceof Error ? err.message : "unknown" });
    return reply(500, { error: "Não foi possível revogar o acesso. Tente novamente." });
  }
}
