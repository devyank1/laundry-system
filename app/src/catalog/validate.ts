// Validação pura do JSON de catálogo (sem Supabase): usada pelo store e pelo
// script de seed, que roda no Node fora do navegador.
import type { CatalogMachine } from "../engine/types";

export function isValidMachine(m: unknown): m is CatalogMachine {
  if (typeof m !== "object" || m === null) return false;
  const c = m as Record<string, unknown>;
  return (
    typeof c.id === "string" && c.id.length > 0 &&
    typeof c.brand === "string" && c.brand.length > 0 &&
    typeof c.model === "string" && c.model.length > 0 &&
    (c.type === "lavadora" || c.type === "secadora" || c.type === "stack") &&
    typeof c.widthMm === "number" && c.widthMm > 0 &&
    typeof c.depthMm === "number" && c.depthMm > 0 &&
    typeof c.heightMm === "number" && c.heightMm > 0
  );
}

export function parseCatalogJSON(json: string): CatalogMachine[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Arquivo inválido: não é um JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("JSON inválido: esperado um array não vazio de máquinas.");
  }
  const invalidIndex = parsed.findIndex((item) => !isValidMachine(item));
  if (invalidIndex !== -1) {
    throw new Error(`JSON inválido: item no índice ${invalidIndex} está incompleto ou com valores inválidos.`);
  }
  return parsed as CatalogMachine[];
}
