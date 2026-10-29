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

// Máquinas que entraram no catálogo padrão depois: aparecem também pra quem
// já tem um catálogo salvo (e somem de novo se a pessoa excluir).
const ADDED_TO_SEED = ["lg-giant-c", "lg-titan", "sq-ssu030", "sq-syc180", "sq-st055"];
// Saiu: o stack SYC180 + ST055 voltou a ser lavadora e secadora avulsas.
const REMOVED_FROM_SEED = ["sq-syc180-st055"];
const SEEN_KEY = "lavanderia.catalog.seen.v1";

// A Stack pequena da Speed Queen se chamava "Stack Elétrica (SSU/SSG)", nome
// que agora é da SSU030 (14 kg).
function renamed(saved: CatalogMachine[]): CatalogMachine[] {
  let list = saved.some((m) => REMOVED_FROM_SEED.includes(m.id)) ? saved.filter((m) => !REMOVED_FROM_SEED.includes(m.id)) : saved;
  // SYC180/ST055 já saíram a 1,40 m e a 70 cm do piso; agora o topo das duas
  // fica nivelado (lavadora 35 cm, secadora 8 cm), em nicho de drywall
  const LEVEL: Record<string, number> = { "sq-syc180": 350, "sq-st055": 80 };
  if (list.some((m) => m.id in LEVEL && (m.concreteBaseMm === 1400 || m.concreteBaseMm === 700))) {
    list = list.map((m) =>
      m.id in LEVEL && (m.concreteBaseMm === 1400 || m.concreteBaseMm === 700) ? { ...m, concreteBaseMm: LEVEL[m.id], baseDrywall: true } : m,
    );
  }
  return list.some((m) => m.id === "sq-stack" && m.model === "Stack Elétrica (SSU/SSG)")
    ? list.map((m) => (m.id === "sq-stack" && m.model === "Stack Elétrica (SSU/SSG)" ? { ...m, model: "Stack 10" } : m))
    : list;
}

function withNewSeed(saved: CatalogMachine[]): CatalogMachine[] {
  const list = renamed(saved);
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    /* segue sem lista */
  }
  const fresh = CATALOG_SEED.filter((m) => ADDED_TO_SEED.includes(m.id) && !seen.includes(m.id) && !list.some((c) => c.id === m.id));
  if (fresh.length === 0) return list;
  // (list pode já ser cópia renomeada; o chamador grava se mudou)
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh.map((m) => m.id)]));
  } catch {
    /* armazenamento indisponível */
  }
  return [...list, ...fresh];
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
    cachedCatalog = Array.isArray(parsed) && parsed.length > 0 ? withNewSeed(parsed) : CATALOG_SEED;
    if (cachedCatalog !== parsed && cachedCatalog !== CATALOG_SEED) {
      // grava já mesclado: no próximo carregamento elas vêm do salvo
      cachedRaw = JSON.stringify(cachedCatalog);
      try {
        localStorage.setItem(STORAGE_KEY, cachedRaw);
      } catch {
        /* armazenamento indisponível */
      }
    }
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
