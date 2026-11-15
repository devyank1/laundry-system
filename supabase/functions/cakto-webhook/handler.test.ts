import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCaktoWebhook, type CaktoDeps } from "./handler.ts";

const secret = "whsec_test";
const now = 1_763_200_000;

async function sign(timestamp: string, body: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${timestamp}.${body}`));
  return "v1=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    event: "purchase_approved",
    data: { id: "ord_1", customer: { email: "Comprador@Mail.com" }, product: { id: "prod_ok" } },
    ...overrides,
  });
}

async function request(body: string, opts: { signature?: string; timestamp?: string } = {}) {
  const ts = opts.timestamp ?? String(now);
  const sig = opts.signature ?? (await sign(ts, body));
  return new Request("http://x/cakto-webhook", {
    method: "POST",
    headers: { "X-Cakto-Signature": sig, "X-Cakto-Timestamp": ts, "Content-Type": "application/json" },
    body,
  });
}

let processed: Set<string>;
let deps: CaktoDeps;

beforeEach(() => {
  processed = new Set();
  deps = {
    secret,
    productIds: ["prod_ok"],
    now: () => now,
    claimEvent: vi.fn(async (id: string) => {
      if (processed.has(id)) return false;
      processed.add(id);
      return true;
    }),
    releaseEvent: vi.fn(async (id: string) => void processed.delete(id)),
    provisionClienteFisico: vi.fn(async () => ({ created: true })),
    log: vi.fn(async () => {}),
  };
});

describe("cakto-webhook", () => {
  it("compra aprovada e assinada cria o cliente físico com o email normalizado", async () => {
    const res = await handleCaktoWebhook(await request(payload()), deps);
    expect(res.status).toBe(200);
    expect(deps.provisionClienteFisico).toHaveBeenCalledWith("comprador@mail.com");
    expect(deps.log).toHaveBeenCalledWith("cakto_cliente_fisico_created", expect.objectContaining({ orderId: "ord_1" }));
  });

  it("assinatura errada é rejeitada (401) antes de qualquer escrita no banco", async () => {
    const res = await handleCaktoWebhook(await request(payload(), { signature: `v1=${"0".repeat(64)}` }), deps);
    expect(res.status).toBe(401);
    expect(deps.claimEvent).not.toHaveBeenCalled();
    expect(deps.provisionClienteFisico).not.toHaveBeenCalled();
  });

  it("timestamp antigo (replay) é rejeitado (401) antes de qualquer escrita", async () => {
    const old = String(now - 600);
    const body = payload();
    const res = await handleCaktoWebhook(await request(body, { timestamp: old, signature: await sign(old, body) }), deps);
    expect(res.status).toBe(401);
    expect(deps.claimEvent).not.toHaveBeenCalled();
  });

  it("mesmo data.id reenviado não cria segunda conta nem manda segundo email", async () => {
    await handleCaktoWebhook(await request(payload()), deps);
    const second = await handleCaktoWebhook(await request(payload()), deps);
    expect(second.status).toBe(200);
    expect(deps.provisionClienteFisico).toHaveBeenCalledTimes(1);
  });

  it("outros eventos são ignorados com 200", async () => {
    const res = await handleCaktoWebhook(await request(payload({ event: "refund" })), deps);
    expect(res.status).toBe(200);
    expect(deps.claimEvent).not.toHaveBeenCalled();
  });

  it("produto que não libera acesso é ignorado com 200", async () => {
    const body = JSON.stringify({ event: "purchase_approved", data: { id: "ord_2", customer: { email: "a@b.com" }, product: { id: "outro" } } });
    const res = await handleCaktoWebhook(await request(body), deps);
    expect(res.status).toBe(200);
    expect(deps.provisionClienteFisico).not.toHaveBeenCalled();
  });

  it("payload sem email válido responde 400 sem criar conta", async () => {
    const body = JSON.stringify({ event: "purchase_approved", data: { id: "ord_3", customer: { email: "x" }, product: { id: "prod_ok" } } });
    const res = await handleCaktoWebhook(await request(body), deps);
    expect(res.status).toBe(400);
    expect(deps.provisionClienteFisico).not.toHaveBeenCalled();
  });

  it("falha ao provisionar libera o evento (reenvio manual funciona) e responde 500 sem detalhe", async () => {
    deps.provisionClienteFisico = vi.fn(async () => {
      throw new Error("Resend respondeu 500");
    });
    const res = await handleCaktoWebhook(await request(payload()), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/resend/i);
    expect(deps.releaseEvent).toHaveBeenCalledWith("ord_1");
    expect(processed.has("ord_1")).toBe(false);
  });

  it("método diferente de POST responde 405", async () => {
    const res = await handleCaktoWebhook(new Request("http://x/cakto-webhook", { method: "GET" }), deps);
    expect(res.status).toBe(405);
  });
});
