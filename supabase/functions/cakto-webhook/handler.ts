// Lógica do webhook da Cakto, sem Deno/npm: as dependências entram por
// parâmetro (index.ts liga as de verdade; os testes usam falsas).
import { verifyCaktoSignature } from "../_shared/caktoSignature.ts";
import { normalizeEmail } from "../_shared/validation.ts";

export interface CaktoDeps {
  secret: string;
  // Produtos da Cakto que liberam acesso de cliente físico.
  productIds: string[];
  now: () => number;
  // true = primeira vez que vemos esse pedido; false = já processado.
  claimEvent: (eventId: string) => Promise<boolean>;
  releaseEvent: (eventId: string) => Promise<void>;
  provisionClienteFisico: (email: string) => Promise<{ created: boolean }>;
  log: (action: string, details: Record<string, unknown>) => Promise<void>;
}

const empty = (status: number) => new Response(null, { status });

interface CaktoPayload {
  event?: unknown;
  data?: { id?: unknown; customer?: { email?: unknown }; product?: { id?: unknown } };
}

export async function handleCaktoWebhook(req: Request, deps: CaktoDeps): Promise<Response> {
  if (req.method !== "POST") return empty(405);

  // Assinatura é calculada sobre os bytes crus, antes de qualquer parse.
  const rawBody = await req.text();
  const valid = await verifyCaktoSignature({
    secret: deps.secret,
    signatureHeader: req.headers.get("X-Cakto-Signature") ?? "",
    timestampHeader: req.headers.get("X-Cakto-Timestamp") ?? "",
    rawBody,
    now: deps.now(),
  });
  if (!valid) return empty(401);

  let body: CaktoPayload;
  try {
    body = JSON.parse(rawBody) as CaktoPayload;
  } catch {
    return empty(400);
  }
  if (body.event !== "purchase_approved") return empty(200);

  const orderId = typeof body.data?.id === "string" || typeof body.data?.id === "number" ? String(body.data.id) : null;
  const productId = body.data?.product?.id != null ? String(body.data.product.id) : null;
  const email = normalizeEmail(body.data?.customer?.email);
  if (!orderId) return empty(400);
  if (!productId || !deps.productIds.includes(productId)) return empty(200);
  if (!email) return empty(400);

  if (!(await deps.claimEvent(orderId))) return empty(200);

  try {
    const { created } = await deps.provisionClienteFisico(email);
    await deps.log(created ? "cakto_cliente_fisico_created" : "cakto_purchase_existing_user", { orderId, productId, email });
    return empty(200);
  } catch (err) {
    // Solta o pedido pra um reenvio manual pelo painel da Cakto funcionar.
    await deps.releaseEvent(orderId);
    console.error("cakto-webhook provisioning failed", { orderId, reason: err instanceof Error ? err.message : "unknown" });
    return empty(500);
  }
}
