import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleInviteColleague, type InviteColleagueDeps } from "./handler.ts";
import { EmailAlreadyRegisteredError } from "../_shared/errors.ts";
import type { Caller } from "../_shared/http.ts";

const owner: Caller = { id: "o1", role: "empresa", companyId: "c1", isOwner: true };
let deps: InviteColleagueDeps;
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  deps = {
    allowedOrigin: "http://localhost:5173",
    getCaller: vi.fn(async () => owner),
    inviteColleague: vi.fn(async () => ({ userId: "n1" })),
    log: vi.fn(async () => {}),
  };
});

describe("company-invite-colleague", () => {
  it("dono convida colega na própria empresa com email normalizado", async () => {
    const res = await handleInviteColleague(post({ email: " Novo@Sul.com " }), deps);
    expect(res.status).toBe(200);
    expect(deps.inviteColleague).toHaveBeenCalledWith({ email: "novo@sul.com", companyId: "c1" });
    expect(deps.log).toHaveBeenCalledWith("o1", "colleague_invited", expect.objectContaining({ companyId: "c1", userId: "n1" }));
  });

  it("colega que não é dono recebe 403", async () => {
    deps.getCaller = vi.fn(async () => ({ ...owner, isOwner: false }));
    expect((await handleInviteColleague(post({ email: "a@b.com" }), deps)).status).toBe(403);
    expect(deps.inviteColleague).not.toHaveBeenCalled();
  });

  it("admin recebe 403 (convite de colega é coisa de empresa)", async () => {
    for (const role of ["admin"] as const) {
      deps.getCaller = vi.fn(async () => ({ id: "x", role, companyId: null, isOwner: false }));
      expect((await handleInviteColleague(post({ email: "a@b.com" }), deps)).status).toBe(403);
    }
    expect(deps.inviteColleague).not.toHaveBeenCalled();
  });

  it("sem login 401; email inválido 400; email já cadastrado 409", async () => {
    deps.getCaller = vi.fn(async () => null);
    expect((await handleInviteColleague(post({ email: "a@b.com" }), deps)).status).toBe(401);
    deps.getCaller = vi.fn(async () => owner);
    expect((await handleInviteColleague(post({ email: "x" }), deps)).status).toBe(400);
    deps.inviteColleague = vi.fn(async () => {
      throw new EmailAlreadyRegisteredError();
    });
    const res = await handleInviteColleague(post({ email: "a@b.com" }), deps);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/já tem cadastro/i);
  });
});
