// ADMIN cadastra empresa parceira + catálogo dela + convida o dono.
import { json, normalizeEmail, type Caller } from "../_shared/http.ts";
import { EmailAlreadyRegisteredError } from "../_shared/errors.ts";

export interface CreateCompanyDeps {
  allowedOrigin: string;
  getCaller: (req: Request) => Promise<Caller | null>;
  knownMachineIds: (ids: string[]) => Promise<string[]>;
  createCompanyWithOwner: (input: { name: string; machineIds: string[]; ownerEmail: string }) => Promise<{ companyId: string }>;
  log: (actorId: string, action: string, details: Record<string, unknown>) => Promise<void>;
}

const MAX_NAME = 120;
const MAX_MACHINES = 500;

export async function handleCreateCompany(req: Request, deps: CreateCompanyDeps): Promise<Response> {
  const reply = (status: number, body: Record<string, unknown>) => json(status, body, deps.allowedOrigin);
  if (req.method === "OPTIONS") return reply(200, {});
  if (req.method !== "POST") return reply(405, { error: "Método não permitido." });

  const caller = await deps.getCaller(req);
  if (!caller) return reply(401, { error: "Sua sessão expirou. Entre novamente." });
  if (caller.role !== "admin") return reply(403, { error: "Sem permissão para cadastrar empresas." });

  let body: { name?: unknown; machineIds?: unknown; ownerEmail?: unknown } | null;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = null;
  }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ownerEmail = normalizeEmail(body?.ownerEmail);
  const rawIds = body?.machineIds;
  if (!name || name.length > MAX_NAME) return reply(400, { error: "Informe o nome da empresa (até 120 caracteres)." });
  if (!ownerEmail) return reply(400, { error: "Informe um email válido para o dono." });
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > MAX_MACHINES || !rawIds.every((id) => typeof id === "string" && id)) {
    return reply(400, { error: "Marque pelo menos uma máquina do catálogo." });
  }
  const machineIds = [...new Set(rawIds as string[])];
  const known = await deps.knownMachineIds(machineIds);
  if (known.length !== machineIds.length) return reply(400, { error: "Alguma máquina marcada não existe mais no catálogo. Recarregue a página." });

  try {
    const { companyId } = await deps.createCompanyWithOwner({ name, machineIds, ownerEmail });
    await deps.log(caller.id, "company_created", { companyId, name, ownerEmail, machineIds });
    return reply(200, { companyId });
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return reply(409, { error: "Este email já tem cadastro no configurador. Use outro email para o dono." });
    }
    console.error("admin-create-company failed", { reason: err instanceof Error ? err.message : "unknown" });
    return reply(500, { error: "Não foi possível cadastrar a empresa. Tente novamente." });
  }
}
