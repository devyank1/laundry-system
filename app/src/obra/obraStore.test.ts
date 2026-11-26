import { beforeEach, describe, expect, it } from "vitest";
import { OBRA_STEPS } from "./steps";
import { normalizeObra, useObraStore } from "./obraStore";

beforeEach(() => {
  localStorage.clear();
  useObraStore.getState().reset();
});

describe("etapas", () => {
  it("25 etapas em ordem, de Prazos até Inauguração", () => {
    expect(OBRA_STEPS).toHaveLength(25);
    expect(OBRA_STEPS.map((s) => s.n)).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(OBRA_STEPS[0].title).toBe("Prazos");
    expect(OBRA_STEPS[24].title).toBe("Inauguração");
    expect(OBRA_STEPS[3]).toMatchObject({ title: "Obrigações legais", goal: "Abrir CNPJ", deadline: "Até 10 dias" });
  });
});

describe("useObraStore", () => {
  it("concluir guarda a data e persiste", () => {
    useObraStore.getState().complete(new Date("2026-11-25T12:00:00Z"));
    expect(useObraStore.getState().doneAt).toEqual(["2026-11-25T12:00:00.000Z"]);
    expect(JSON.parse(localStorage.getItem("lavanderia.obra.v1")!).doneAt).toHaveLength(1);
  });

  it("depois da última etapa não conclui mais nada", () => {
    for (let i = 0; i < 30; i++) useObraStore.getState().complete();
    expect(useObraStore.getState().doneAt).toHaveLength(25);
  });

  it("desfazer tira só a última; vazio não faz nada", () => {
    useObraStore.getState().undo();
    expect(useObraStore.getState().doneAt).toEqual([]);
    useObraStore.getState().complete();
    useObraStore.getState().complete();
    useObraStore.getState().undo();
    expect(useObraStore.getState().doneAt).toHaveLength(1);
  });

  it("normalizeObra saneia lixo", () => {
    expect(normalizeObra(null)).toEqual({ doneAt: [] });
    expect(normalizeObra({ doneAt: "x" })).toEqual({ doneAt: [] });
    expect(normalizeObra({ doneAt: ["2026-11-01T00:00:00.000Z", "não é data", 3] })).toEqual({ doneAt: ["2026-11-01T00:00:00.000Z"] });
    expect(normalizeObra({ doneAt: Array(40).fill("2026-11-01T00:00:00.000Z") }).doneAt).toHaveLength(25);
  });
});
