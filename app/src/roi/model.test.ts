import { describe, expect, it } from "vitest";
import { computeRoi, defaultRoiState, sumFixo, type RoiState } from "./model";

const r = Math.round;

function withState(patch: (s: RoiState) => void): RoiState {
  const s = defaultRoiState();
  patch(s);
  return s;
}

describe("modelo de ROI — valores iniciais (iguais aos da calculadora de referência)", () => {
  const m = computeRoi(defaultRoiState());

  it("investimento", () => {
    expect(m.inv).toBe(300414);
    expect(m.infra).toBe(43480);
    expect(m.units).toBe(5);
  });

  it("operação em regime pleno", () => {
    expect(r(m.full.recMes)).toBe(45360);
    expect(r(m.custoOp)).toBe(16392);
    expect(r(m.full.imp)).toBe(4536);
    expect(r(m.full.margem)).toBe(24432);
  });

  it("indicadores exibidos como inteiros", () => {
    expect(r(m.pbSimples ?? NaN)).toBe(12);
    expect(r(m.roi)).toBe(98);
    expect(r(m.pb ?? NaN)).toBe(17);
    expect(r(m.lucro)).toBe(1058503);
  });

  it("receita de rampa", () => {
    expect(r(m.rev1)).toBe(20412);
    expect(r(m.revY1)).toBe(394632);
  });

  it("cenários conservador / realista / otimista", () => {
    expect(m.scen.map((s) => r(s.margem))).toEqual([19027, 24432, 29838]);
    expect(m.scen.map((s) => r(s.pb ?? NaN))).toEqual([20, 17, 14]);
  });

  it("custo fixo inicial é a soma arredondada dos itens", () => {
    expect(defaultRoiState().cost.fixoTotal).toBe(8000);
    expect(sumFixo([{ nome: "a", val: 10.4 }, { nome: "b", val: 10.4 }])).toBe(21);
  });
});

describe("modelo de ROI — cenários de conferência", () => {
  it("B: financiado (30% de entrada, 36 meses, 1,8% a.m.), 8 ciclos, preço 22", () => {
    const m = computeRoi(
      withState((s) => {
        s.op.ciclos = 8;
        s.op.preco = 22;
        s.pay = { mode: "fin", entrada: 30, prazo: 36, taxa: 1.8, unit: "am" };
      }),
    );
    expect(m.inv).toBe(300414);
    expect(r(m.full.recMes)).toBe(73920);
    expect(r(m.custoOp)).toBe(19189);
    expect(r(m.full.margem)).toBe(47339);
    expect(r(m.pb ?? NaN)).toBe(6);
    expect(r(m.roi)).toBe(189);
    expect(r(m.lucro)).toBe(2280054);
    expect(r(m.plan.entrada)).toBe(90124);
    expect(r(m.plan.parcela)).toBe(7988);
    expect(m.plan.n).toBe(36);
    expect(r(m.plan.juros)).toBe(77264);
    expect(m.scen.map((s) => r(s.margem))).toEqual([40422, 47339, 54257]);
    expect(m.scen.map((s) => r(s.pb ?? NaN))).toEqual([7, 6, 5]);
  });

  it("C: quantidades 1/0/2/1, secagem 120%, rampa 50% em 8 meses, horizonte de 4 anos", () => {
    const m = computeRoi(
      withState((s) => {
        [1, 0, 2, 1].forEach((q, i) => (s.equip[i].qtd = q));
        s.op = { ciclos: 7, utilSec: 120, preco: 20, dias: 30, rampIni: 50, rampMeses: 8 };
        s.cost.imposto = 8;
        s.cost.anos = 4;
      }),
    );
    expect(m.inv).toBe(345354);
    expect(r(m.full.recMes)).toBe(92400);
    expect(r(m.custoOp)).toBe(22893);
    expect(r(m.full.margem)).toBe(62115);
    expect(r(m.pb ?? NaN)).toBe(8);
    expect(r(m.pbSimples ?? NaN)).toBe(6);
    expect(r(m.roi)).toBe(216);
    expect(r(m.lucro)).toBe(2495927);
    expect(m.scen.map((s) => r(s.margem))).toEqual([52098, 62115, 72131]);
    expect(m.scen.map((s) => r(s.pb ?? NaN))).toEqual([9, 8, 7]);
  });
});

describe("modelo de ROI — bordas", () => {
  it("itens 'por máquina' multiplicam pelo nº de equipamentos; 'fixo' não", () => {
    const m = computeRoi(
      withState((s) => {
        s.infra = [
          { nome: "a", tipo: "fixo", val: 1000 },
          { nome: "b", tipo: "maq", val: 100 },
        ];
      }),
    );
    expect(m.infra).toBe(1000 + 100 * 5);
  });

  it("sem equipamentos sobra só a infra fixa, a margem é negativa e não há payback", () => {
    const m = computeRoi(withState((s) => s.equip.forEach((e) => (e.qtd = 0))));
    expect(m.inv).toBe(29380); // itens "fixo" continuam; os "por máquina" zeram
    expect(m.full.margem).toBeLessThan(0);
    expect(m.roi).toBeLessThan(0);
    expect(m.pbSimples).toBeNull();
    expect(m.pb).toBeNull();
    expect(Number.isFinite(m.lucro)).toBe(true);
  });

  it("investimento zero não gera divisão por zero no ROI", () => {
    const m = computeRoi(
      withState((s) => {
        s.equip.forEach((e) => (e.qtd = 0));
        s.infra = [];
      }),
    );
    expect(m.inv).toBe(0);
    expect(m.roi).toBe(0);
  });

  it("à vista: entrada = investimento e nenhuma parcela", () => {
    const m = computeRoi(defaultRoiState());
    expect(m.plan.entrada).toBe(m.inv);
    expect(m.plan.parcela).toBe(0);
  });

  it("taxa anual é convertida para mensal equivalente", () => {
    const m = computeRoi(withState((s) => (s.pay = { mode: "fin", entrada: 0, prazo: 12, taxa: 12.682503013196973, unit: "aa" })));
    expect(m.plan.im).toBeCloseTo(0.01, 12);
  });

  it("entradas vazias ou inválidas viram zero em vez de NaN", () => {
    const s = defaultRoiState();
    (s.op as unknown as Record<string, unknown>).preco = "";
    (s.equip[0] as unknown as Record<string, unknown>).qtd = "abc";
    const m = computeRoi(s);
    expect(Number.isNaN(m.inv)).toBe(false);
    expect(Number.isNaN(m.full.margem)).toBe(false);
  });

  it("cenário conservador nunca usa menos de 1 ciclo", () => {
    const m = computeRoi(withState((s) => (s.op.ciclos = 1)));
    expect(m.scen[0].ciclos).toBe(1);
  });
});
