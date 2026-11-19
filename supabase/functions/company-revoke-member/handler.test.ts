import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleRevokeMember, type RevokeMemberDeps } from "./handler.ts";
import type { Caller } from "../_shared/http.ts";

const owner: Caller = { id: "o1", role: "empresa", companyId: "c1", isOwner: true };
let deps: RevokeMemberDeps;
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });
const UID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  deps = {
    allowedOrigin: "http://localhost:5173",
    getCaller: vi.fn(async () => owner),
    deactivateColleague: vi.fn(async () => "revoked" as const),
    log: vi.fn(async () => {}),
  };
});

describe("company-revoke-member", () => {
  it("dono revoga colega da própria empresa", async () => {
    const res = await handleRevokeMember(post({ userId: UID }), deps);
    expect(res.status).toBe(200);
    expect(deps.deactivateColleague).toHaveBeenCalledWith({ userId: UID, companyId: "c1" });
    expect(deps.log).toHaveBeenCalledWith("o1", "colleague_revoked", { companyId: "c1", userId: UID });
    expect(await res.json()).toEqual({ result: "revoked" });
  });

  it("convite nunca aceito é cancelado (usuário removido)", async () => {
    deps.deactivateColleague = vi.fn(async () => "removed" as const);
    const res = await handleRevokeMember(post({ userId: UID }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "removed" });
    expect(deps.log).toHaveBeenCalledWith("o1", "colleague_invite_cancelled", { companyId: "c1", userId: UID });
  });

  it("colega fora da empresa (ou o próprio dono) responde 404 sem revelar nada", async () => {
    deps.deactivateColleague = vi.fn(async () => "not_found" as const);
    expect((await handleRevokeMember(post({ userId: UID }), deps)).status).toBe(404);
    expect(deps.log).not.toHaveBeenCalled();
  });

  it("dono não revoga a si mesmo", async () => {
    const res = await handleRevokeMember(post({ userId: "o1" }), deps);
    expect(res.status).toBe(400);
    expect(deps.deactivateColleague).not.toHaveBeenCalled();
  });

  it("não-dono 403, sem login 401, userId inválido 400", async () => {
    deps.getCaller = vi.fn(async () => ({ ...owner, isOwner: false }));
    expect((await handleRevokeMember(post({ userId: UID }), deps)).status).toBe(403);
    deps.getCaller = vi.fn(async () => null);
    expect((await handleRevokeMember(post({ userId: UID }), deps)).status).toBe(401);
    deps.getCaller = vi.fn(async () => owner);
    expect((await handleRevokeMember(post({ userId: "not-a-uuid" }), deps)).status).toBe(400);
    expect(deps.deactivateColleague).not.toHaveBeenCalled();
  });
});
