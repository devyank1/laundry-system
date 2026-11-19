import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), signOut: vi.fn(async () => ({ error: null })) }));
vi.mock("../lib/supabaseClient", () => ({ supabase: { rpc: mocks.rpc, auth: { signOut: mocks.signOut } } }));

import { claimSession, isCurrentSession, loginAndClaim, waitForClaim, SESSION_REPLACED_MESSAGE } from "./session";

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.signOut.mockClear();
});

describe("session", () => {
  it("tem a mensagem exata de derrubada", () => {
    expect(SESSION_REPLACED_MESSAGE).toBe("Seu acesso neste aparelho foi encerrado porque a conta entrou em outro aparelho.");
  });

  it("claimSession reivindica antes de encerrar as outras sessões", async () => {
    const order: string[] = [];
    mocks.rpc.mockImplementation(async (name: string) => {
      order.push(name);
      return { data: null, error: null };
    });
    mocks.signOut.mockImplementation(async () => {
      order.push("signOut");
      return { error: null };
    });
    await claimSession();
    expect(mocks.rpc).toHaveBeenCalledWith("claim_session", { p_user_agent: expect.any(String) });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(order).toEqual(["claim_session", "signOut"]);
  });

  it("isCurrentSession: false quando o servidor diz que não é a atual; true em erro de rede", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await isCurrentSession()).toBe(false);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } });
    expect(await isCurrentSession()).toBe(true);
  });

  it("loginAndClaim segura quem espera até a reivindicação terminar", async () => {
    let finishLogin!: (v: { error: null }) => void;
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const done = loginAndClaim(() => new Promise<{ error: null }>((r) => (finishLogin = r)));
    let released = false;
    const waiting = waitForClaim().then(() => (released = true));
    await Promise.resolve();
    expect(released).toBe(false);
    finishLogin({ error: null });
    await done;
    await waiting;
    expect(released).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_session", expect.anything());
  });

  it("loginAndClaim não reivindica quando o login falha", async () => {
    const res = await loginAndClaim(async () => ({ error: { message: "bad" } }));
    expect(res.error).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("loginAndClaim desfaz o login se a reivindicação falhar", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(loginAndClaim(async () => ({ error: null }))).rejects.toThrow();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
