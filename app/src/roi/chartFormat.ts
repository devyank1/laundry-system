// Formatadores e paleta dos gráficos (separados dos componentes por causa do fast refresh).

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
export const money = (v: number) => brl.format(Math.round(v));
export const brlShort = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

/** Eixo em reais: "250 mil", "1,2 mi". */
export const thousands = (v: number) => {
  if (Math.abs(v) < 1) return "0";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  return `${int.format(Math.round(v / 1000))} mil`;
};

// Estilos de linha: a principal grossa em degradê; as outras finas, uma tracejada
// (pra não depender só da cor).
export const LINE = {
  main: { color: "var(--line-main)", width: 2.75, dash: undefined },
  opt: { color: "var(--line-opt)", width: 1.5, dash: undefined },
  cons: { color: "var(--line-cons)", width: 1.5, dash: "5 4" },
} as const;
export type LineStyle = (typeof LINE)[keyof typeof LINE];

// Paleta das roscas: 4 cores por tema, definidas em index.css (--chart-1..4).
// Escuro: lima, ciano, verde, violeta (neon). Claro: azul, petróleo, laranja,
// marinho. As duas passam no validador de daltonismo; a legenda traz nome e valor.
export const PIE = { c1: "var(--chart-1)", c2: "var(--chart-2)", c3: "var(--chart-3)", c4: "var(--chart-4)" };

export type Slice = { label: string; value: number; color: string; hint?: string };

