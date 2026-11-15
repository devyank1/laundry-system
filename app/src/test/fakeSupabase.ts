import { CATALOG_SEED } from "../catalog/seed";
import type { CatalogMachine } from "../engine/types";

// Supabase falso, só pra testes: uma tabela catalog_machines em memória com o
// subconjunto da API que catalog/store.ts usa. Uso:
//   vi.mock("../lib/supabaseClient", async () => (await import("../test/fakeSupabase")).fakeSupabaseModule());
//   beforeEach(async () => { resetFakeCatalog(); await refreshCatalog(); });

interface Row {
  id: string;
  data: CatalogMachine;
}

const table = new Map<string, Row>();
export const fakeCalls = { upserts: [] as Row[][], deletes: [] as string[], failWrites: false };

export function resetFakeCatalog(machines: CatalogMachine[] = CATALOG_SEED): void {
  table.clear();
  fakeCalls.upserts = [];
  fakeCalls.deletes = [];
  fakeCalls.failWrites = false;
  for (const m of machines) table.set(m.id, { id: m.id, data: structuredClone(m) });
}

function catalogTable() {
  return {
    select: async () => ({ data: [...table.values()].map((r) => structuredClone(r)), error: null }),
    upsert: async (rows: Row | Row[]) => {
      if (fakeCalls.failWrites) return { error: { message: "new row violates row-level security policy", code: "42501" } };
      const list = Array.isArray(rows) ? rows : [rows];
      fakeCalls.upserts.push(list);
      for (const r of list) table.set(r.id, structuredClone(r));
      return { error: null };
    },
    delete: () => ({
      eq: async (_column: "id", id: string) => {
        if (fakeCalls.failWrites) return { error: { message: "permission denied", code: "42501" } };
        fakeCalls.deletes.push(id);
        table.delete(id);
        return { error: null };
      },
    }),
  };
}

export function fakeSupabaseModule() {
  return {
    supabase: {
      from: (name: string) => {
        if (name !== "catalog_machines") throw new Error(`fakeSupabase: tabela ${name} não simulada`);
        return catalogTable();
      },
    },
  };
}
