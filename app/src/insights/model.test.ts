import { describe, expect, it } from "vitest";
import { computeInsights, defaultInsightsInputs, formatBRL0, parseBR, verdictText, type InsightsInputs } from "./model";

const brl = (n: number | null) => formatBRL0(n).replace(/ /g, " ");
const withInputs = (patch: (i: InsightsInputs) => void) => {
  const i = defaultInsightsInputs();
  patch(i);
  return i;
};

describe("parseBR (igual ao original)", () => {
  it("lê vírgula decimal e ponto de milhar", () => {
    expect(parseBR("2.900,00")).toBe(2900);
    expect(parseBR("577,5")).toBe(577.5);
    expect(parseBR("18")).toBe(18);
  });
  it("vazio e texto viram NaN", () => {
    expect(parseBR("")).toBeNaN();
    expect(parseBR("   ")).toBeNaN();
    expect(parseBR("abc")).toBeNaN();
  });
  it("sem vírgula o ponto é decimal: '2.900' vira 2,9 (comportamento do site)", () => {
    expect(parseBR("2.900")).toBe(2.9);
  });
});

describe("conectividade — valores iniciais (iguais aos da página de referência)", () => {
  const r = computeInsights(defaultInsightsInputs());
  it("frota e faturamento", () => {
    expect(r.bocas).toBe(6);
    expect(brl(r.annualRev)).toBe("R$ 473.040");
  });
  it("economia anual", () => {
    expect(brl(r.visitSav)).toBe("R$ 2.970");
    expect(brl(r.downRec)).toBe("R$ 2.333");
    expect(brl(r.annual)).toBe("R$ 5.303");
  });
  it("cenário A", () => {
    expect(brl(r.capex)).toBe("R$ 6.362");
    expect(r.verdict).toMatchObject({ kind: "ok", months: 15 });
    expect(brl(r.net3)).toBe("R$ 9.546");
    expect(verdictText(r.verdict).replace(/\u00a0/g, " ")).toBe(
      "Recupera R$ 6.362 (6 boca(s) precisam de placa) em 15 meses, só com a economia de serviço.",
    );
  });
  it("cenário B", () => {
    expect(brl(r.planA)).toBe("R$ 1.296");
    expect(brl(r.bNetYr)).toBe("R$ 4.007");
    expect(brl(r.bNet3)).toBe("R$ 5.658");
  });
});

describe("conectividade — bordas", () => {
  it("sem bocas: tudo '—' e pede para preencher a frota", () => {
    const r = computeInsights(withInputs((i) => (i.fleet = { p: "0", m: "0", g: "0", x: "0" })));
    expect(r.annualRev).toBeNull();
    expect(r.annual).toBeNull();
    expect(r.capex).toBeNull();
    expect(r.verdict.kind).toBe("incomplete");
    expect(r.planA).toBeNull();
  });
  it("sem economia (0% resolvível): sem payback", () => {
    const r = computeInsights(withInputs((i) => (i.pct = "0")));
    expect(r.verdict.kind).toBe("noSavings");
    expect(brl(r.net3)).toBe("-R$ 6.362");
  });
  it("payback nunca é menor que 1 mês", () => {
    const r = computeInsights(withInputs((i) => ((i.gwprice = "1"), (i.needplaca = "0"))));
    expect(r.verdict).toMatchObject({ kind: "ok", months: 1 });
  });
  it("sem placa necessária o texto fala só do gateway", () => {
    const r = computeInsights(withInputs((i) => (i.needplaca = "0")));
    expect(verdictText(r.verdict)).toContain("as bocas já têm placa — só o gateway");
    expect(brl(r.capex)).toBe("R$ 2.900");
  });
  it("preço do gateway vazio: não há investimento nem payback", () => {
    const r = computeInsights(withInputs((i) => (i.gwprice = "")));
    expect(r.capex).toBeNull();
    expect(r.verdict.kind).toBe("incomplete");
    expect(r.net3).toBeNull();
  });
  it("licença vazia esconde o cenário B", () => {
    const r = computeInsights(withInputs((i) => (i.licprice = "")));
    expect(r.planA).toBeNull();
    expect(r.bNetYr).toBeNull();
    expect(r.bNet3).toBeNull();
  });
  it("nº de gateways vazio conta como 1", () => {
    const r = computeInsights(withInputs((i) => ((i.gwqty = ""), (i.needplaca = "0"))));
    expect(brl(r.capex)).toBe("R$ 2.900");
  });
});
