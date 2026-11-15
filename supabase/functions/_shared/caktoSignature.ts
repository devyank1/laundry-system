// Verifica o webhook da Cakto: X-Cakto-Signature = "v1=<hex>" com
// HMAC-SHA256 de "{X-Cakto-Timestamp}.{corpo cru}". Puro (Web Crypto), roda
// igual no Deno (Edge Function) e no Node (testes).

const encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Comparação em tempo constante: não sai no primeiro byte diferente.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyCaktoSignature(params: {
  secret: string;
  signatureHeader: string;
  timestampHeader: string;
  rawBody: string;
  now?: number;
  maxSkewSeconds?: number;
}): Promise<boolean> {
  const { secret, signatureHeader, timestampHeader, rawBody } = params;
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const maxSkewSeconds = params.maxSkewSeconds ?? 300;

  if (!secret) return false;
  const match = /^v1=([0-9a-fA-F]+)$/.exec(signatureHeader.trim());
  if (!match) return false;
  const received = hexToBytes(match[1]);
  if (!received) return false;
  if (!/^\d+$/.test(timestampHeader.trim())) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestampHeader.trim()}.${rawBody}`)));
  if (!timingSafeEqual(expected, received)) return false;

  // Anti-replay: assinatura válida mas antiga não passa.
  return Math.abs(now - Number(timestampHeader.trim())) <= maxSkewSeconds;
}
