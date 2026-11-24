import type { CatalogMachine } from "../engine/types";
import { supabase } from "../lib/supabaseClient";
import { parseCatalogJSON } from "./validate";

export { isValidMachine, parseCatalogJSON } from "./validate";

// Catálogo vem da tabela catalog_machines. A RLS já entrega só o que o papel
// pode ver (empresa: subconjunto negociado; admin: completo),
// e só admin consegue escrever. Aqui fica um cache em memória pros
// componentes lerem de forma síncrona (useSyncExternalStore).

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: CatalogMachine[] = [];

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeCatalog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCatalog(): CatalogMachine[] {
  return cached;
}

export async function refreshCatalog(): Promise<void> {
  const { data, error } = await supabase.from("catalog_machines").select("id, data");
  if (error) throw new Error("Não foi possível carregar o catálogo de máquinas.");
  const rows = (data ?? []) as { id: string; data: CatalogMachine }[];
  cached = rows.map((row) => row.data).sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  emitChange();
}

export function resetCatalog(): void {
  cached = [];
  emitChange();
}

// Escritas: a RLS só aceita de admin. Erro do banco nunca sobe cru pra tela.
const WRITE_FAILED = "Não foi possível salvar no catálogo. Tente novamente.";

async function upsertMachines(machines: CatalogMachine[]): Promise<void> {
  const { error } = await supabase.from("catalog_machines").upsert(machines.map((m) => ({ id: m.id, data: m })));
  if (error) throw new Error(WRITE_FAILED);
  await refreshCatalog();
}

export async function addMachine(machine: CatalogMachine): Promise<void> {
  await upsertMachines([machine]);
}

export async function updateMachine(id: string, patch: Partial<CatalogMachine>): Promise<void> {
  const current = cached.find((m) => m.id === id);
  if (!current) throw new Error("Máquina não encontrada no catálogo.");
  await upsertMachines([{ ...current, ...patch, id }]);
}

export async function deleteMachine(id: string): Promise<void> {
  const { error } = await supabase.from("catalog_machines").delete().eq("id", id);
  if (error) throw new Error(WRITE_FAILED);
  await refreshCatalog();
}

export function exportCatalogJSON(): string {
  return JSON.stringify(cached, null, 2);
}

// Importa = adiciona/atualiza as máquinas do arquivo. Não apaga as que
// faltam (evita esvaziar o catálogo de produção com um arquivo errado).
export async function importCatalogJSON(json: string): Promise<void> {
  await upsertMachines(parseCatalogJSON(json));
}
