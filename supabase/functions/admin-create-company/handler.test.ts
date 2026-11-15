import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCreateCompany, type CreateCompanyDeps } from "./handler.ts";
import { EmailAlreadyRegisteredError } from "../_shared/errors.ts";
import type { Caller } from "../_shared/http.ts";

const admin: Caller = { id: "a1", role: "admin", companyId: null, isOwner: false };
const empresa: Caller = { id: "e1", role: "empresa", companyId: "c9", isOwner: true };

let deps: CreateCompanyDeps;

function post(body: unknown) {
  return new Request("http://x/admin-create-company", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(body) });
}

const valid = { name: "  Lavanderias Sul ", machineIds: ["m1", "m2", "m1"], ownerEmail: "Dono@Sul.com" };

beforeEach(() => {
  deps = {
    allowedOrigin: "http://localhost:5173",
    getCaller: vi.fn(async () => admin),
    knownMachineIds: vi.fn(async (ids: string[]) => ids.filter((id) => id !== "nao-existe")),
    createCompanyWithOwner: vi.fn(async () => ({ companyId: "c1" })),
    log: vi.fn(async () => {}),
  };
});

describe("admin-create-company", () => {
  it("admin cria empresa com dados normalizados e recebe companyId", async () => {
    const res = await handleCreateCompany(post(valid), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ companyId: "c1" });
    expect(deps.createCompanyWithOwner).toHaveBeenCalledWith({ name: "Lavanderias Sul", machineIds: ["m1", "m2"], ownerEmail: "dono@sul.com" });
    expect(deps.log).toHaveBeenCalledWith("a1", "company_created", expect.objectContaining({ companyId: "c1" }));
  });

  it("sem login responde 401 sem criar nada", async () => {
    deps.getCaller = vi.fn(async () => null);
    const res = await handleCreateCompany(post(valid), deps);
    expect(res.status).toBe(401);
    expect(deps.createCompanyWithOwner).not.toHaveBeenCalled();
  });

  it("empresa (não admin) responde 403 sem criar nada", async () => {
    deps.getCaller = vi.fn(async () => empresa);
    const res = await handleCreateCompany(post(valid), deps);
    expect(res.status).toBe(403);
    expect(deps.createCompanyWithOwner).not.toHaveBeenCalled();
  });

  it("dados inválidos respondem 400 com mensagem amigável", async () => {
    for (const body of [{ ...valid, name: "" }, { ...valid, ownerEmail: "x" }, { ...valid, machineIds: [] }, { ...valid, machineIds: "m1" }, null]) {
      const res = await handleCreateCompany(post(body), deps);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toEqual(expect.any(String));
    }
    expect(deps.createCompanyWithOwner).not.toHaveBeenCalled();
  });

  it("máquina que não existe no catálogo responde 400", async () => {
    const res = await handleCreateCompany(post({ ...valid, machineIds: ["m1", "nao-existe"] }), deps);
    expect(res.status).toBe(400);
    expect(deps.createCompanyWithOwner).not.toHaveBeenCalled();
  });

  it("email do dono já cadastrado responde 409 com mensagem amigável", async () => {
    deps.createCompanyWithOwner = vi.fn(async () => {
      throw new EmailAlreadyRegisteredError();
    });
    const res = await handleCreateCompany(post(valid), deps);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/já tem cadastro/i);
  });

  it("falha inesperada responde 500 sem detalhe técnico", async () => {
    deps.createCompanyWithOwner = vi.fn(async () => {
      throw new Error("duplicate key value violates unique constraint companies_pkey");
    });
    const res = await handleCreateCompany(post(valid), deps);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/duplicate|constraint/);
  });

  it("OPTIONS (preflight CORS) responde 200 com a origem do app", async () => {
    const res = await handleCreateCompany(new Request("http://x", { method: "OPTIONS" }), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });
});
