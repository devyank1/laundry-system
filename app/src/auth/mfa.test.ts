import { beforeEach, describe, expect, it, vi } from "vitest";

const mfa = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}));
vi.mock("../lib/supabaseClient", () => ({ supabase: { auth: { mfa } } }));

import { mfaStateFor, startEnroll, verifiedFactorId, verifyCode } from "./mfa";

function factors(list: { id: string; status: "verified" | "unverified" }[]) {
  return { data: { all: list.map((f) => ({ ...f, factor_type: "totp" })), totp: list.filter((f) => f.status === "verified") }, error: null };
}

beforeEach(() => {
  for (const fn of Object.values(mfa)) fn.mockReset();
  mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  mfa.listFactors.mockResolvedValue(factors([]));
  mfa.unenroll.mockResolvedValue({ data: {}, error: null });
});

describe("mfaStateFor", () => {
  it("empresa e cliente não passam por código", async () => {
    expect(await mfaStateFor("empresa")).toBe("ok");
    expect(await mfaStateFor("cliente_fisico")).toBe("ok");
    expect(mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("admin que já digitou o código (aal2) está ok", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    expect(await mfaStateFor("admin")).toBe("ok");
  });

  it("admin com celular cadastrado precisa digitar o código", async () => {
    mfa.listFactors.mockResolvedValue(factors([{ id: "f1", status: "verified" }]));
    expect(await mfaStateFor("admin")).toBe("verify");
  });

  it("admin sem celular cadastrado precisa cadastrar (fator abandonado não conta)", async () => {
    mfa.listFactors.mockResolvedValue(factors([{ id: "f0", status: "unverified" }]));
    expect(await mfaStateFor("admin")).toBe("enroll");
  });

  it("erro ao consultar trata como precisa do código (nunca libera)", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await mfaStateFor("admin")).toBe("verify");
  });
});

describe("startEnroll", () => {
  it("remove cadastro abandonado antes de gerar o QR code", async () => {
    mfa.listFactors.mockResolvedValue(factors([{ id: "f0", status: "unverified" }]));
    mfa.enroll.mockResolvedValue({ data: { id: "f2", totp: { qr_code: "data:image/svg+xml;utf8,<svg/>", secret: "ABC" } }, error: null });
    expect(await startEnroll()).toEqual({ factorId: "f2", qrCode: "data:image/svg+xml;utf8,<svg/>", secret: "ABC" });
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f0" });
    expect(mfa.unenroll.mock.invocationCallOrder[0]).toBeLessThan(mfa.enroll.mock.invocationCallOrder[0]);
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Configurador" });
  });

  it("falha ao gerar vira mensagem amigável", async () => {
    mfa.enroll.mockResolvedValue({ data: null, error: { message: "mfa disabled" } });
    await expect(startEnroll()).rejects.toThrow("Não foi possível gerar o QR code. Tente novamente.");
  });
});

describe("verifyCode / verifiedFactorId", () => {
  it("código certo passa", async () => {
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    await verifyCode("f1", "123456");
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" });
  });

  it("código errado vira 'Código inválido.' sem detalhe do servidor", async () => {
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "Invalid TOTP code entered" } });
    await expect(verifyCode("f1", "000000")).rejects.toThrow(/^Código inválido\.$/);
  });

  it("acha o celular já cadastrado", async () => {
    mfa.listFactors.mockResolvedValue(factors([{ id: "f0", status: "unverified" }, { id: "f1", status: "verified" }]));
    expect(await verifiedFactorId()).toBe("f1");
  });
});
