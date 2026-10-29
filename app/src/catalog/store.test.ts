import { beforeEach, describe, expect, it } from "vitest";
import {
  addMachine,
  deleteMachine,
  exportCatalogJSON,
  getCatalog,
  importCatalogJSON,
  restoreDefaults,
  updateMachine,
} from "./store";
import { CATALOG_SEED } from "./seed";

beforeEach(() => {
  localStorage.clear();
});

describe("catalog store", () => {
  it("catálogo salvo antigo ganha as LG uma vez; excluída não volta", () => {
    localStorage.setItem("lavanderia.catalog.v1", JSON.stringify(CATALOG_SEED.slice(0, 3)));
    expect(getCatalog().map((m) => m.id)).toEqual(["sq-stack", "mamute-smart10", "mamute-smart17", "lg-giant-c", "lg-titan", "sq-ssu030", "sq-syc180", "sq-st055"]);
    deleteMachine("lg-titan");
    expect(getCatalog().map((m) => m.id)).not.toContain("lg-titan");
    expect(getCatalog().map((m) => m.id)).toContain("lg-giant-c");
  });

  it("retorna o catálogo seed quando não há nada salvo", () => {
    expect(getCatalog()).toEqual(CATALOG_SEED);
  });

  it("adiciona uma máquina nova e persiste", () => {
    const custom = { ...CATALOG_SEED[0], id: "custom-1", model: "Custom" };
    addMachine(custom);
    expect(getCatalog()).toContainEqual(custom);
  });

  it("atualiza uma máquina existente mantendo o id", () => {
    updateMachine("sq-stack", { model: "Stack Atualizada" });
    const updated = getCatalog().find((m) => m.id === "sq-stack");
    expect(updated?.model).toBe("Stack Atualizada");
  });

  it("remove uma máquina", () => {
    deleteMachine("sq-stack");
    expect(getCatalog().find((m) => m.id === "sq-stack")).toBeUndefined();
  });

  it("restaura o catálogo padrão", () => {
    deleteMachine("sq-stack");
    restoreDefaults();
    expect(getCatalog()).toEqual(CATALOG_SEED);
  });

  it("exporta e reimporta o catálogo mantendo os dados", () => {
    const json = exportCatalogJSON();
    deleteMachine("sq-stack");
    const imported = importCatalogJSON(json);
    expect(imported).toEqual(CATALOG_SEED);
    expect(getCatalog()).toEqual(CATALOG_SEED);
  });

  it("rejeita JSON que não é um array", () => {
    expect(() => importCatalogJSON('{"a":1}')).toThrow();
  });

  it("rejeita import com array vazio", () => {
    expect(() => importCatalogJSON("[]")).toThrow();
  });

  it("rejeita import com item faltando campos obrigatórios", () => {
    const invalid = JSON.stringify([{ id: "x", brand: "Y" }]);
    expect(() => importCatalogJSON(invalid)).toThrow();
  });
});
