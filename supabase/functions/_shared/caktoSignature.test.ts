import { describe, expect, it } from "vitest";
import { verifyCaktoSignature } from "./caktoSignature.ts";

const secret = "whsec_test_123";
const rawBody = '{"event":"purchase_approved","data":{"id":"ord_1"}}';
const now = 1_763_200_000;

async function sign(timestamp: string, body: string, key = secret): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${timestamp}.${body}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("verifyCaktoSignature", () => {
  it("retorna true pra uma assinatura HMAC-SHA256 correta e timestamp recente", async () => {
    const ts = String(now - 10);
    const ok = await verifyCaktoSignature({ secret, signatureHeader: `v1=${await sign(ts, rawBody)}`, timestampHeader: ts, rawBody, now });
    expect(ok).toBe(true);
  });

  it("retorna false quando a assinatura não bate", async () => {
    const ts = String(now);
    const ok = await verifyCaktoSignature({ secret, signatureHeader: `v1=${"0".repeat(64)}`, timestampHeader: ts, rawBody, now });
    expect(ok).toBe(false);
  });

  it("retorna false quando o corpo foi alterado depois de assinado", async () => {
    const ts = String(now);
    const sig = await sign(ts, rawBody);
    const ok = await verifyCaktoSignature({ secret, signatureHeader: `v1=${sig}`, timestampHeader: ts, rawBody: rawBody.replace("ord_1", "ord_2"), now });
    expect(ok).toBe(false);
  });

  it("retorna false quando assinado com outro secret", async () => {
    const ts = String(now);
    const ok = await verifyCaktoSignature({ secret, signatureHeader: `v1=${await sign(ts, rawBody, "outro")}`, timestampHeader: ts, rawBody, now });
    expect(ok).toBe(false);
  });

  it("retorna false quando o timestamp está fora da janela de maxSkewSeconds", async () => {
    const ts = String(now - 301);
    const ok = await verifyCaktoSignature({ secret, signatureHeader: `v1=${await sign(ts, rawBody)}`, timestampHeader: ts, rawBody, now });
    expect(ok).toBe(false);
  });

  it("retorna false quando signatureHeader não está no formato v1=<hex>", async () => {
    const ts = String(now);
    expect(await verifyCaktoSignature({ secret, signatureHeader: "abc", timestampHeader: ts, rawBody, now })).toBe(false);
    expect(await verifyCaktoSignature({ secret, signatureHeader: "", timestampHeader: ts, rawBody, now })).toBe(false);
  });

  it("retorna false com timestamp ausente ou não numérico", async () => {
    const sig = await sign("abc", rawBody);
    expect(await verifyCaktoSignature({ secret, signatureHeader: `v1=${sig}`, timestampHeader: "abc", rawBody, now })).toBe(false);
    expect(await verifyCaktoSignature({ secret, signatureHeader: `v1=${sig}`, timestampHeader: "", rawBody, now })).toBe(false);
  });

  it("retorna false com secret vazio (webhook mal configurado nunca aceita)", async () => {
    const ts = String(now);
    expect(await verifyCaktoSignature({ secret: "", signatureHeader: `v1=${await sign(ts, rawBody)}`, timestampHeader: ts, rawBody, now })).toBe(false);
  });
});
