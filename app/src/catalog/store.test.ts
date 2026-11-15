import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG_SEED } from "./seed";
import { fakeCalls, resetFakeCatalog } from "../test/fakeSupabase";

vi.mock("../lib/supabaseClient", async () => (await import("../test/fakeSupabase")).fakeSupabaseModule());

import {
  addMachine,
  deleteMachine,
  exportCatalogJSON,
  getCatalog,
  importCatalogJSON,
  refreshCatalog,
  resetCatalog,
  subscribeCatalog,
  updateMachine,
} from "./store";

beforeEach(() => {
  resetCatalog();
  resetFakeCatalog(CATALOG_SEED.slice(0, 2));
});

describe("catalog store (Supabase)", () => {
  it("getCatalog começa vazio antes de qualquer refreshCatalog", () => {
    expect(getCatalog()).toEqual([]);
  });

  it("refreshCatalog busca catalog_machines, popula o cache e notifica os listeners", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCatalog(listener);
    await refreshCatalog();
    unsubscribe();
    expect(getCatalog().map((m) => m.id).sort()).toEqual(CATALOG_SEED.slice(0, 2).map((m) => m.id).sort());
    expect(getCatalog().find((m) => m.id === CATALOG_SEED[0].id)).toEqual(CATALOG_SEED[0]);
    expect(listener).toHaveBeenCalled();
  });

  it("getCatalog devolve a mesma referência entre chamadas (useSyncExternalStore)", async () => {
    await refreshCatalog();
    expect(getCatalog()).toBe(getCatalog());
  });

  it("ordena por marca e modelo (o banco não garante ordem)", async () => {
    await refreshCatalog();
    const labels = getCatalog().map((m) => `${m.brand} ${m.model}`);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("resetCatalog esvazia o cache e notifica os listeners", async () => {
    await refreshCatalog();
    const listener = vi.fn();
    subscribeCatalog(listener);
    resetCatalog();
    expect(getCatalog()).toEqual([]);
    expect(listener).toHaveBeenCalled();
  });
});

describe("catalog store — escrita (admin)", () => {
  beforeEach(async () => {
    await refreshCatalog();
  });

  it("addMachine faz upsert em catalog_machines e atualiza o cache", async () => {
    const custom = { ...CATALOG_SEED[0], id: "custom-1", model: "Custom" };
    await addMachine(custom);
    expect(fakeCalls.upserts).toEqual([[{ id: "custom-1", data: custom }]]);
    expect(getCatalog()).toContainEqual(custom);
  });

  it("updateMachine grava a máquina mesclada mantendo o id", async () => {
    await updateMachine(CATALOG_SEED[0].id, { model: "Atualizada", id: "outro-id" });
    const updated = getCatalog().find((m) => m.id === CATALOG_SEED[0].id);
    expect(updated?.model).toBe("Atualizada");
    expect(getCatalog().some((m) => m.id === "outro-id")).toBe(false);
  });

  it("deleteMachine remove a linha por id e atualiza o cache", async () => {
    await deleteMachine(CATALOG_SEED[0].id);
    expect(fakeCalls.deletes).toEqual([CATALOG_SEED[0].id]);
    expect(getCatalog().find((m) => m.id === CATALOG_SEED[0].id)).toBeUndefined();
  });

  it("exporta e reimporta o catálogo mantendo os dados", async () => {
    const json = exportCatalogJSON();
    await deleteMachine(CATALOG_SEED[0].id);
    await importCatalogJSON(json);
    expect(getCatalog().map((m) => m.id).sort()).toEqual(CATALOG_SEED.slice(0, 2).map((m) => m.id).sort());
  });

  it("importCatalogJSON com item inválido lança erro e NÃO chama upsert", async () => {
    await expect(importCatalogJSON(JSON.stringify([{ id: "x", brand: "Y" }]))).rejects.toThrow();
    expect(fakeCalls.upserts).toEqual([]);
  });

  it("rejeita JSON que não é um array ou array vazio", async () => {
    await expect(importCatalogJSON('{"a":1}')).rejects.toThrow();
    await expect(importCatalogJSON("[]")).rejects.toThrow();
    expect(fakeCalls.upserts).toEqual([]);
  });
});
