import { beforeEach, describe, expect, it } from "vitest";
import { OBRA_STEPS } from "./steps";
import { EXTRA_MAX, currentIndex, normalizeObra, useObraStore } from "./obraStore";

const st = () => useObraStore.getState();
const titles = () => OBRA_STEPS.map((s) => s.title);
const idx = (id: string) => OBRA_STEPS.findIndex((s) => s.id === id);

// Marca o checklist da etapa atual e conclui.
function finishStep() {
  const step = OBRA_STEPS[currentIndex(st().doneAt)];
  for (const c of step?.checklist ?? []) if (!st().checked.includes(c.id)) st().toggle(c.id);
  st().complete();
}

beforeEach(() => {
  localStorage.clear();
  st().reset();
});

describe("etapas", () => {
  it("28 etapas, de Prazos até Inauguração, ids únicos", () => {
    expect(OBRA_STEPS).toHaveLength(28);
    expect(titles()[0]).toBe("Prazos");
    expect(titles()[27]).toBe("Inauguração");
    const ids = [...OBRA_STEPS.map((s) => s.id), ...OBRA_STEPS.flatMap((s) => (s.checklist ?? []).map((c) => c.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("etapas novas no lugar pedido", () => {
    expect(titles()[idx("inpi") + 1]).toBe("Criação do Instagram e do Google Meu Negócio");
    expect(OBRA_STEPS[idx("planta-eletrica") + 1].title).toBe("Aprovação dos projetos hidráulico e elétrico pelos engenheiros");
    expect(OBRA_STEPS[idx("eletrica") - 1]).toMatchObject({ title: "Início das compras de materiais hidráulicos e elétricos", extras: true });
  });

  it("nomes e checklists alterados", () => {
    expect(OBRA_STEPS[idx("gesso")].title).toBe("Estrutura de gesso / drywall");
    expect(idx("gesso")).toBeGreaterThan(idx("eletrica"));
    expect(OBRA_STEPS[idx("pagamento")].title).toBe("Solicitação do sistema de pagamento da Cicclo ou Lavecom");
    expect(OBRA_STEPS[idx("instalacao")].title).toBe("Instalação técnica do maquinário com sistema de pagamento e automações");
    expect(OBRA_STEPS[idx("comunicacao-visual")].checklist).toHaveLength(4);
    expect(OBRA_STEPS[idx("ponto")].checklist).toHaveLength(8);
    expect(OBRA_STEPS[idx("legal")].checklist![1].text).toBe("Abrir CNPJ ou MEI");
    expect(OBRA_STEPS[idx("inauguracao")]).toMatchObject({ optionalChecklist: true });
    expect(OBRA_STEPS[idx("inauguracao")].checklist).toHaveLength(8);
  });
});

describe("useObraStore", () => {
  it("concluir guarda a data pelo id e persiste", () => {
    st().complete(new Date("2026-11-25T12:00:00Z"));
    expect(st().doneAt).toEqual({ prazos: "2026-11-25T12:00:00.000Z" });
    expect(JSON.parse(localStorage.getItem("lavanderia.obra.v2")!).doneAt.prazos).toBeTruthy();
  });

  it("checklist obrigatório trava; opcional não", () => {
    st().complete();
    st().complete();
    expect(currentIndex(st().doneAt)).toBe(idx("ponto"));
    for (const c of OBRA_STEPS[idx("ponto")].checklist!.slice(0, -1)) st().toggle(c.id);
    st().complete();
    expect(currentIndex(st().doneAt)).toBe(idx("ponto"));
    st().toggle("ponto-h");
    st().complete();
    expect(currentIndex(st().doneAt)).toBe(idx("internet"));
    while (currentIndex(st().doneAt) < idx("inauguracao")) finishStep();
    st().complete(); // inauguração sem marcar nada
    expect(currentIndex(st().doneAt)).toBe(OBRA_STEPS.length);
  });

  it("depois da última etapa não conclui mais nada", () => {
    for (let i = 0; i < 40; i++) finishStep();
    expect(Object.keys(st().doneAt)).toHaveLength(28);
  });

  it("marcar só da etapa atual", () => {
    st().complete();
    st().toggle("ponto-c");
    expect(st().checked).toEqual(["ponto-c"]);
    st().toggle("ponto-c");
    st().toggle("legal-a");
    st().toggle("xx");
    expect(st().checked).toEqual([]);
  });

  it("desfazer volta a anterior à atual; vazio não faz nada", () => {
    st().undo();
    expect(st().doneAt).toEqual({});
    finishStep();
    finishStep();
    st().undo();
    expect(Object.keys(st().doneAt)).toEqual(["prazos"]);
  });

  it("etapa nova inserida antes de concluídas vira a atual", () => {
    st().replaceAll({ doneAt: { prazos: "2026-11-01T00:00:00.000Z", internet: "2026-11-02T00:00:00.000Z" }, checked: [], extras: [] });
    expect(currentIndex(st().doneAt)).toBe(idx("ponto"));
  });

  it("materiais extras: adiciona, ignora vazio, limita, remove", () => {
    st().addExtra("  Piso vinílico  ");
    st().addExtra("   ");
    st().addExtra("x".repeat(300));
    expect(st().extras).toEqual([
      { text: "Piso vinílico", bought: false },
      { text: "x".repeat(120), bought: false },
    ]);
    st().toggleExtra(0);
    expect(st().extras[0].bought).toBe(true);
    st().toggleExtra(0);
    expect(st().extras[0].bought).toBe(false);
    st().toggleExtra(9);
    st().removeExtra(0);
    st().removeExtra(9);
    expect(st().extras).toEqual([{ text: "x".repeat(120), bought: false }]);
    for (let i = 0; i < 80; i++) st().addExtra(`m${i}`);
    expect(st().extras).toHaveLength(EXTRA_MAX);
  });

  it("normalizeObra saneia lixo", () => {
    expect(normalizeObra(null)).toEqual({ doneAt: {}, checked: [], extras: [] });
    expect(normalizeObra({ doneAt: ["2026-11-01T00:00:00.000Z"] }).doneAt).toEqual({});
    expect(normalizeObra({ doneAt: { prazos: "2026-11-01T00:00:00.000Z", zz: "2026-11-01T00:00:00.000Z", ponto: "não" } }).doneAt).toEqual({
      prazos: "2026-11-01T00:00:00.000Z",
    });
    expect(normalizeObra({ checked: ["ponto-a", "ponto-a", "zz", 5] }).checked).toEqual(["ponto-a"]);
    expect(normalizeObra({ extras: [{ text: "Piso", bought: true }, { text: "Rodapé", bought: "sim" }, "Tinta", 3, { text: " " }, null] }).extras).toEqual([
      { text: "Piso", bought: true },
      { text: "Rodapé", bought: false },
      { text: "Tinta", bought: false },
    ]);
  });
});
