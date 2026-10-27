/*
 * Calculadora de conectividade ("Insights") — sem DOM, sem React.
 *
 * Port literal do script da página go.speedqueen.com/TelemetriaROI. Os campos
 * entram como TEXTO, exatamente como o usuário digitou, e passam pelo mesmo
 * parseBR do original (inclusive a esquisitice: "2.900" sem vírgula vira 2,9).
 */

export const OPDAYS = 365;

export const TIERS = [
  { id: "p", label: "Pequena (≤12 kg)", rate: 18 },
  { id: "m", label: "Média (13–18 kg)", rate: 36 },
  { id: "g", label: "Grande (19–23 kg)", rate: 54 },
  { id: "x", label: "Extra (>23 kg)", rate: 72 },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

export interface InsightsInputs {
  fleet: Record<TierId, string>;
  cycles: string;
  needplaca: string;
  issues: string;
  visitcost: string;
  /** % de problemas resolvíveis remotamente (0–100) */
  pct: string;
  downdays: string;
  gwprice: string;
  gwqty: string;
  boardprice: string;
  licprice: string;
}

export function defaultInsightsInputs(): InsightsInputs {
  return {
    fleet: { p: "4", m: "2", g: "0", x: "0" },
    cycles: "9",
    needplaca: "6",
    issues: "3",
    visitcost: "550",
    pct: "30",
    downdays: "2",
    gwprice: "2.900,00",
    gwqty: "1",
    boardprice: "577,00",
    licprice: "18,00",
  };
}

/** Igual ao parseBR do original: vazio/ilegível => NaN; com vírgula, ponto é milhar. */
export function parseBR(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim();
  if (s === "") return NaN;
  if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

const fmt0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
/** R$ sem centavos, como o original; null/NaN => "—". */
export function formatBRL0(n: number | null): string {
  return n === null || isNaN(n) ? "—" : fmt0.format(n);
}
export function mesesLabel(m: number): string {
  return m === 1 ? "1 mês" : m + " meses";
}

export type Verdict =
  | { kind: "ok"; months: number; capex: number; need: number }
  | { kind: "noSavings" }
  | { kind: "incomplete" };

export interface InsightsResult {
  bocas: number;
  /** pct já em 0–100, arredondado como na tela */
  pctShown: number;
  /** faturamento anual de referência; null quando não há bocas ("—") */
  annualRev: number | null;
  visitSav: number | null;
  downRec: number | null;
  annual: number | null;
  /** economia anual real (0 quando não há bocas) — base dos demais cálculos */
  annualRaw: number;
  capex: number | null;
  verdict: Verdict;
  net3: number | null;
  planA: number | null;
  bNetYr: number | null;
  bNet3: number | null;
}

const nz = (n: number): number => (isNaN(n) ? 0 : n);
const orNull = (n: number): number | null => (isNaN(n) ? null : n);

export function computeInsights(inp: InsightsInputs): InsightsResult {
  const pct = (parseBR(inp.pct) || 0) / 100;
  let bocas = 0;
  let weighted = 0;
  TIERS.forEach((t) => {
    const q = nz(parseBR(inp.fleet[t.id]));
    bocas += q;
    weighted += q * t.rate;
  });
  const avgRate = bocas > 0 ? weighted / bocas : 0;
  const C = nz(parseBR(inp.cycles));
  const annualRev = C * weighted * OPDAYS;
  const perBocaDay = C * avgRate;
  const issues = nz(parseBR(inp.issues));
  const vc = nz(parseBR(inp.visitcost));
  const dd = nz(parseBR(inp.downdays));
  const totalIssues = bocas * issues;
  const resolvable = totalIssues * pct;
  const visitSav = resolvable * vc;
  const downRec = resolvable * dd * perBocaDay;
  const annual = visitSav + downRec;

  const gw = parseBR(inp.gwprice);
  const gwq = parseBR(inp.gwqty);
  const bp = parseBR(inp.boardprice);
  const need = nz(parseBR(inp.needplaca));
  const haveCapex = !isNaN(gw) && bocas > 0;
  const capex = haveCapex ? gw * (isNaN(gwq) ? 1 : gwq) + (isNaN(bp) ? 0 : bp) * need : NaN;

  let verdict: Verdict;
  if (haveCapex && annual > 0) {
    verdict = { kind: "ok", months: Math.max(1, Math.ceil(capex / (annual / 12))), capex, need };
  } else if (haveCapex && annual <= 0) {
    verdict = { kind: "noSavings" };
  } else {
    verdict = { kind: "incomplete" };
  }

  const lic = parseBR(inp.licprice);
  const planA = !isNaN(lic) && bocas > 0 ? lic * bocas * 12 : NaN;

  return {
    bocas,
    pctShown: Math.round(pct * 100),
    annualRev: bocas ? annualRev : null,
    visitSav: bocas ? visitSav : null,
    downRec: bocas ? downRec : null,
    annual: bocas ? annual : null,
    annualRaw: annual,
    capex: orNull(capex),
    verdict,
    net3: haveCapex ? annual * 3 - capex : null,
    planA: orNull(planA),
    bNetYr: isNaN(planA) ? null : annual - planA,
    bNet3: isNaN(planA) ? null : haveCapex ? annual * 3 - capex - planA * 3 : null,
  };
}

/** Texto do veredito, igual ao do original. */
export function verdictText(v: Verdict): string {
  if (v.kind === "ok") {
    const boardMsg = v.need > 0 ? `${v.need} boca(s) precisam de placa` : "as bocas já têm placa — só o gateway";
    return `Recupera ${formatBRL0(v.capex)} (${boardMsg}) em ${mesesLabel(v.months)}, só com a economia de serviço.`;
  }
  if (v.kind === "noSavings") return "Ajuste serviço/paradas: sem economia anual não há payback.";
  return "Preencha a frota e confirme os preços para ver o retorno.";
}
