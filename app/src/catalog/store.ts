import type { CatalogMachine } from "../engine/types";
import { CATALOG_SEED } from "./seed";

const STORAGE_KEY = "lavanderia.catalog.v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeCatalog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let cachedRaw: string | null = null;
let cachedCatalog: CatalogMachine[] = CATALOG_SEED;

export function getCatalog(): CatalogMachine[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedCatalog;
  cachedRaw = raw;
  if (!raw) {
    cachedCatalog = CATALOG_SEED;
    return cachedCatalog;
  }
  try {
    const parsed = JSON.parse(raw) as CatalogMachine[];
    cachedCatalog = Array.isArray(parsed) && parsed.length > 0 ? parsed : CATALOG_SEED;
  } catch {
    cachedCatalog = CATALOG_SEED;
  }
  return cachedCatalog;
}

function persist(list: CatalogMachine[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  emitChange();
}

export function addMachine(machine: CatalogMachine): CatalogMachine[] {
  const list = [...getCatalog(), machine];
  persist(list);
  return list;
}

export function updateMachine(id: string, patch: Partial<CatalogMachine>): CatalogMachine[] {
  const list = getCatalog().map((m) => (m.id === id ? { ...m, ...patch, id } : m));
  persist(list);
  return list;
}

export function deleteMachine(id: string): CatalogMachine[] {
  const list = getCatalog().filter((m) => m.id !== id);
  persist(list);
  return list;
}

export function restoreDefaults(): CatalogMachine[] {
  persist(CATALOG_SEED);
  return CATALOG_SEED;
}

export function exportCatalogJSON(): string {
  return JSON.stringify(getCatalog(), null, 2);
}

function isValidMachine(m: unknown): m is CatalogMachine {
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

export function importCatalogJSON(json: string): CatalogMachine[] {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("JSON inválido: esperado um array não vazio de máquinas.");
  }
  const invalidIndex = parsed.findIndex((item) => !isValidMachine(item));
  if (invalidIndex !== -1) {
    throw new Error(`JSON inválido: item no índice ${invalidIndex} está incompleto ou com valores inválidos.`);
  }
  persist(parsed);
  return parsed;
}
