import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleInviteAdmin, type InviteAdminDeps } from "./handler.ts";
import { EmailAlreadyRegisteredError } from "../_shared/errors.ts";
import type { Caller } from "../_shared/http.ts";

const admin: Caller = { id: "a1", role: "admin", companyId: null, isOwner: false };
const empresa: Caller = { id: "e1", role: "empresa", companyId: "c9", isOwner: true };

let deps: InviteAdminDeps;

function post(body: unknown) {
  return new Request("http://x/admin-invite-admin", { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  deps = {
    allowedOrigin: "http://localhost:5173",
    getCaller: vi.fn(async () => admin),
    inviteAdmin: vi.fn(async () => ({ userId: "u1", reusedAccount: false })),
    log: vi.fn(async () => {}),
  };
});

describe("admin-invite-admin", () => {
  it("admin convida com email normalizado, recebe userId e fica na auditoria", async () => {
    const res = await handleInviteAdmin(post({ email: " Novo@X.com " }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "u1" });
    expect(deps.inviteAdmin).toHaveBeenCalledWith({ email: "novo@x.com" });
    expect(deps.log).toHaveBeenCalledWith("a1", "admin_invited", { invitedUserId: "u1", email: "novo@x.com", reusedAccount: false });
  });

  it("sem login responde 401 sem convidar", async () => {
    deps.getCaller = vi.fn(async () => null);
    expect((await handleInviteAdmin(post({ email: "novo@x.com" }), deps)).status).toBe(401);
    expect(deps.inviteAdmin).not.toHaveBeenCalled();
  });

  it("empresa (não admin) responde 403 sem convidar", async () => {
    deps.getCaller = vi.fn(async () => empresa);
    expect((await handleInviteAdmin(post({ email: "novo@x.com" }), deps)).status).toBe(403);
    expect(deps.inviteAdmin).not.toHaveBeenCalled();
  });

  it("email inválido ou body vazio responde 400", async () => {
    for (const body of [{ email: "x" }, {}, null]) {
      const res = await handleInviteAdmin(post(body), deps);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toEqual(expect.any(String));
    }
    expect(deps.inviteAdmin).not.toHaveBeenCalled();
  });

  it("email que já tem perfil responde 409 e não registra convite", async () => {
    deps.inviteAdmin = vi.fn(async () => {
      throw new EmailAlreadyRegisteredError();
    });
    const res = await handleInviteAdmin(post({ email: "novo@x.com" }), deps);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/já tem cadastro/i);
    expect(deps.log).not.toHaveBeenCalled();
  });

  it("falha inesperada responde 500 sem detalhe técnico", async () => {
    deps.inviteAdmin = vi.fn(async () => {
      throw new Error("profiles insert falhou: 42501");
    });
    const res = await handleInviteAdmin(post({ email: "novo@x.com" }), deps);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/42501|insert/);
  });

  it("OPTIONS responde 200 com a origem do app; GET responde 405", async () => {
    const pre = await handleInviteAdmin(new Request("http://x", { method: "OPTIONS" }), deps);
    expect(pre.status).toBe(200);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect((await handleInviteAdmin(new Request("http://x", { method: "GET" }), deps)).status).toBe(405);
  });
});
