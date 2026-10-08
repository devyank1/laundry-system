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

export function getCatalog(): CatalogMachine[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return CATALOG_SEED;
  try {
    const parsed = JSON.parse(raw) as CatalogMachine[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : CATALOG_SEED;
  } catch {
    return CATALOG_SEED;
  }
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
