import { beforeEach, describe, expect, it } from "vitest";
import { OBRA_STEPS } from "./steps";
import { normalizeObra, useObraStore } from "./obraStore";

// Marca o checklist da etapa atual e conclui.
function finishStep() {
  const step = OBRA_STEPS[useObraStore.getState().doneAt.length];
  for (const c of step?.checklist ?? []) if (!useObraStore.getState().checked.includes(c.id)) useObraStore.getState().toggle(c.id);
  useObraStore.getState().complete();
}

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
    expect(OBRA_STEPS[3]).toMatchObject({ title: "Obrigações legais", deadline: "Até 10 dias" });
  });

  it("checklists: ponto de A a H, obrigações legais de A a D", () => {
    expect(OBRA_STEPS[1].checklist!.map((c) => c.id)).toEqual(["1a", "1b", "1c", "1d", "1e", "1f", "1g", "1h"]);
    expect(OBRA_STEPS[1].checklist![2].text).toMatch(/1,5 km/);
    expect(OBRA_STEPS[3].checklist!.map((c) => c.id)).toEqual(["3a", "3b", "3c", "3d"]);
    expect(OBRA_STEPS[3].checklist![1].text).toMatch(/CNPJ ou MEI/);
    expect(OBRA_STEPS[2].goal).toMatch(/plano/);
    expect(OBRA_STEPS[5].goal).toMatch(/realmente precise/);
    const ids = OBRA_STEPS.flatMap((s) => (s.checklist ?? []).map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("useObraStore", () => {
  it("concluir guarda a data e persiste", () => {
    useObraStore.getState().complete(new Date("2026-11-25T12:00:00Z"));
    expect(useObraStore.getState().doneAt).toEqual(["2026-11-25T12:00:00.000Z"]);
    expect(JSON.parse(localStorage.getItem("lavanderia.obra.v1")!).doneAt).toHaveLength(1);
  });

  it("depois da última etapa não conclui mais nada", () => {
    for (let i = 0; i < 30; i++) finishStep();
    expect(useObraStore.getState().doneAt).toHaveLength(25);
  });

  it("desfazer tira só a última; vazio não faz nada", () => {
    useObraStore.getState().undo();
    expect(useObraStore.getState().doneAt).toEqual([]);
    finishStep();
    finishStep();
    useObraStore.getState().undo();
    expect(useObraStore.getState().doneAt).toHaveLength(1);
  });

  it("etapa com checklist só conclui com tudo marcado", () => {
    finishStep(); // 0, sem checklist
    useObraStore.getState().complete();
    expect(useObraStore.getState().doneAt).toHaveLength(1);
    for (const c of OBRA_STEPS[1].checklist!.slice(0, -1)) useObraStore.getState().toggle(c.id);
    useObraStore.getState().complete();
    expect(useObraStore.getState().doneAt).toHaveLength(1);
    useObraStore.getState().toggle("1h");
    useObraStore.getState().complete();
    expect(useObraStore.getState().doneAt).toHaveLength(2);
  });

  it("marcar e desmarcar item; só da etapa atual; persiste", () => {
    finishStep();
    useObraStore.getState().toggle("1c");
    expect(useObraStore.getState().checked).toEqual(["1c"]);
    expect(JSON.parse(localStorage.getItem("lavanderia.obra.v1")!).checked).toEqual(["1c"]);
    useObraStore.getState().toggle("1c");
    expect(useObraStore.getState().checked).toEqual([]);
    useObraStore.getState().toggle("3a"); // etapa futura
    useObraStore.getState().toggle("xx"); // desconhecido
    expect(useObraStore.getState().checked).toEqual([]);
  });

  it("normalizeObra saneia lixo", () => {
    expect(normalizeObra(null)).toEqual({ doneAt: [], checked: [] });
    expect(normalizeObra({ doneAt: "x" })).toEqual({ doneAt: [], checked: [] });
    expect(normalizeObra({ doneAt: ["2026-11-01T00:00:00.000Z", "não é data", 3] })).toEqual({ doneAt: ["2026-11-01T00:00:00.000Z"], checked: [] });
    expect(normalizeObra({ doneAt: [], checked: ["1a", "1a", "zz", 5] }).checked).toEqual(["1a"]);
    expect(normalizeObra({ doneAt: Array(40).fill("2026-11-01T00:00:00.000Z") }).doneAt).toHaveLength(25);
  });
});
