import { json, type Caller } from "./http.ts";

// Comum às functions do dono da empresa: método, CORS, login e papel.
// Devolve a resposta de erro pronta, ou o chamador já validado.
export async function requireCompanyOwner(
  req: Request,
  allowedOrigin: string,
  getCaller: (req: Request) => Promise<Caller | null>,
): Promise<Response | (Caller & { companyId: string })> {
  if (req.method === "OPTIONS") return json(200, {}, allowedOrigin);
  if (req.method !== "POST") return json(405, { error: "Método não permitido." }, allowedOrigin);
  const caller = await getCaller(req);
  if (!caller) return json(401, { error: "Sua sessão expirou. Entre novamente." }, allowedOrigin);
  if (caller.role !== "empresa" || !caller.isOwner || !caller.companyId) {
    return json(403, { error: "Só o dono da empresa pode gerenciar a equipe." }, allowedOrigin);
  }
  return { ...caller, companyId: caller.companyId };
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
