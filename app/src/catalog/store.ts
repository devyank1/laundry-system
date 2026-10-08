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

export function importCatalogJSON(json: string): CatalogMachine[] {
  const parsed = JSON.parse(json) as CatalogMachine[];
  if (!Array.isArray(parsed)) {
    throw new Error("JSON inválido: esperado um array de máquinas.");
  }
  persist(parsed);
  return parsed;
}
