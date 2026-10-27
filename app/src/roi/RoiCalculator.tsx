import { useMemo, useState } from "react";
import { computeRoi, type RoiResult } from "./model";
import { useRoiStore } from "./roiStore";
import "./roi.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const money = (v: number) => brl.format(Math.round(v));
const months = (v: number | null) => (v === null ? "—" : `${Math.round(v)} meses`);

/** Campo numérico que aceita vírgula e deixa apagar o conteúdo enquanto se digita. */
function NumInput({
  label,
  value,
  onChange,
  suffix,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min?: number;
}) {
  const [text, setText] = useState(String(value));
  // Se o valor mudar por fora (restaurar, recalcular total), o campo acompanha.
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if (parseFloat(text.replace(",", ".")) !== value) setText(String(value));
  }
  return (
    <label className="roi-field">
      <span>{label}</span>
      <span className="roi-input">
        <input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value.replace(",", "."));
            const v = Number.isFinite(n) ? n : 0;
            onChange(min !== undefined ? Math.max(min, v) : v);
          }}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="roi-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function CashChart({ m }: { m: RoiResult }) {
  const W = 640;
  const H = 220;
  const pad = { l: 56, r: 12, t: 12, b: 24 };
  const all = m.scen.flatMap((s) => s.series);
  if (all.length < 2) return null;
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const n = m.scen[0].series.length - 1;
  const x = (i: number) => pad.l + (i / Math.max(1, n)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const colors = ["#c0352b", "#0b3d59", "#2e7d32"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="roi-chart" role="img" aria-label="Caixa acumulado ao longo do tempo">
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="currentColor" opacity=".35" />
      <text x={pad.l - 6} y={y(0) + 4} textAnchor="end" fontSize="10">0</text>
      <text x={pad.l - 6} y={y(hi) + 10} textAnchor="end" fontSize="10">{int.format(Math.round(hi / 1000))} mil</text>
      <text x={pad.l - 6} y={y(lo)} textAnchor="end" fontSize="10">{int.format(Math.round(lo / 1000))} mil</text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="10">{Math.round(n / 12)} anos</text>
      {m.scen.map((s, i) => (
        <path key={s.label} d={path(s.series)} fill="none" stroke={colors[i]} strokeWidth={i === 1 ? 2.5 : 1.5} />
      ))}
      {m.pb !== null && m.pb <= n && (
        <circle cx={x(m.pb)} cy={y(0)} r="4.5" fill={colors[1]} stroke="#fff" strokeWidth="1.5" />
      )}
    </svg>
  );
}

export function RoiCalculator() {
  const s = useRoiStore();
  const state = useMemo(
    () => ({ equip: s.equip, infra: s.infra, fixo: s.fixo, op: s.op, cost: s.cost, pay: s.pay }),
    [s.equip, s.infra, s.fixo, s.op, s.cost, s.pay],
  );
  const m = useMemo(() => computeRoi(state), [state]);

  return (
    <section className="roi" aria-label="Calculadora de retorno">
      <div className="roi-head">
        <h2>Calculadora de retorno da lavanderia</h2>
        <button type="button" onClick={() => window.confirm("Voltar tudo para os valores iniciais?") && s.reset()}>
          Restaurar valores iniciais
        </button>
      </div>

      <div className="roi-results">
        <Stat label="Investimento total" value={money(m.inv)} hint={`equipamentos ${money(m.equip)} + infra ${money(m.infra)}`} />
        <Stat label="Margem mensal (plena)" value={money(m.full.margem)} hint={`receita ${money(m.full.recMes)}`} />
        <Stat label="Payback (com rampa)" value={months(m.pb)} hint={m.pbSimples === null ? undefined : `simples: ${months(m.pbSimples)}`} />
        <Stat label="ROI anual" value={`${Math.round(m.roi)}%`} />
        <Stat label={`Caixa em ${m.anos} anos`} value={money(m.lucro)} />
      </div>

      <div className="roi-card">
        <h3>Caixa acumulado</h3>
        <CashChart m={m} />
        <table className="roi-table">
          <thead>
            <tr><th>Cenário</th><th>Ciclos/boca/dia</th><th>Margem mensal</th><th>Payback</th></tr>
          </thead>
          <tbody>
            {m.scen.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td><td>{c.ciclos}</td><td>{money(c.margem)}</td><td>{months(c.pb)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="roi-note">
          Receita no mês 1: {money(m.rev1)} ({Math.round(m.util1 * 100)}% de ocupação) · receita do 1º ano: {money(m.revY1)} · custo operacional
          mensal: {money(m.custoOp)} · impostos: {money(m.full.imp)}/mês.
        </p>
      </div>

      <div className="roi-card">
        <h3>Equipamentos</h3>
        {s.equip.map((e, i) => (
          <div className="roi-row" key={i}>
            <span className="roi-name">{e.nome}</span>
            <NumInput label={`Preço — ${e.nome}`} value={e.preco} min={0} suffix="R$" onChange={(v) => s.setEquip(i, { preco: v })} />
            <NumInput label={`Quantidade — ${e.nome}`} value={e.qtd} min={0} onChange={(v) => s.setEquip(i, { qtd: v })} />
            <span className="roi-sub">{money(m.equipRows[i] ?? 0)}</span>
          </div>
        ))}
      </div>

      <div className="roi-card">
        <h3>Operação</h3>
        <div className="roi-grid">
          <NumInput label="Ciclos por boca por dia" value={s.op.ciclos} min={0} onChange={(v) => s.setOp("ciclos", v)} />
          <NumInput label="Uso da secagem" value={s.op.utilSec} min={0} suffix="%" onChange={(v) => s.setOp("utilSec", v)} />
          <NumInput label="Preço por cesto" value={s.op.preco} min={0} suffix="R$" onChange={(v) => s.setOp("preco", v)} />
          <NumInput label="Dias de operação por mês" value={s.op.dias} min={0} onChange={(v) => s.setOp("dias", v)} />
          <NumInput label="Ocupação no mês 1" value={s.op.rampIni} min={0} suffix="%" onChange={(v) => s.setOp("rampIni", v)} />
          <NumInput label="Meses até a ocupação plena" value={s.op.rampMeses} min={0} onChange={(v) => s.setOp("rampMeses", v)} />
        </div>
      </div>

      <div className="roi-card">
        <h3>Custos</h3>
        <div className="roi-grid">
          <NumInput label="Custo variável por cesto lavado" value={s.cost.cLav} min={0} suffix="R$" onChange={(v) => s.setCost("cLav", v)} />
          <NumInput label="Custo variável por cesto seco" value={s.cost.cSec} min={0} suffix="R$" onChange={(v) => s.setCost("cSec", v)} />
          <NumInput label="Impostos sobre a receita" value={s.cost.imposto} min={0} suffix="%" onChange={(v) => s.setCost("imposto", v)} />
          <NumInput label="Horizonte da análise" value={s.cost.anos} min={0} suffix="anos" onChange={(v) => s.setCost("anos", v)} />
          <NumInput label="Custo fixo mensal (total)" value={s.cost.fixoTotal} min={0} suffix="R$" onChange={(v) => s.setCost("fixoTotal", v)} />
        </div>
        <details>
          <summary>Detalhar custos fixos</summary>
          {s.fixo.map((f, i) => (
            <div className="roi-row" key={i}>
              <input className="roi-name-input" aria-label={`Nome do custo fixo ${i + 1}`} value={f.nome} onChange={(e) => s.setFixo(i, { nome: e.target.value })} />
              <NumInput label={`Valor — ${f.nome}`} value={f.val} min={0} suffix="R$" onChange={(v) => s.setFixo(i, { val: v })} />
              <button type="button" aria-label={`Remover ${f.nome}`} onClick={() => s.removeFixo(i)}>×</button>
            </div>
          ))}
          <button type="button" onClick={s.addFixo}>+ custo fixo</button>
        </details>
      </div>

      <div className="roi-card">
        <h3>Infraestrutura</h3>
        <p className="roi-note">Itens “por máquina” são multiplicados pelo nº de equipamentos ({m.units}). Total: {money(m.infra)}.</p>
        <details>
          <summary>Detalhar itens</summary>
          {s.infra.map((it, i) => (
            <div className="roi-row" key={i}>
              <input className="roi-name-input" aria-label={`Nome do item de infra ${i + 1}`} value={it.nome} onChange={(e) => s.setInfra(i, { nome: e.target.value })} />
              <select aria-label={`Tipo — ${it.nome}`} value={it.tipo} onChange={(e) => s.setInfra(i, { tipo: e.target.value as "fixo" | "maq" })}>
                <option value="fixo">Fixo</option>
                <option value="maq">Por máquina</option>
              </select>
              <NumInput label={`Valor — ${it.nome}`} value={it.val} min={0} suffix="R$" onChange={(v) => s.setInfra(i, { val: v })} />
              <span className="roi-sub">{money(m.infraRows[i] ?? 0)}</span>
              <button type="button" aria-label={`Remover ${it.nome}`} onClick={() => s.removeInfra(i)}>×</button>
            </div>
          ))}
          <button type="button" onClick={s.addInfra}>+ item de infra</button>
        </details>
      </div>

      <div className="roi-card">
        <h3>Pagamento</h3>
        <div className="roi-seg" role="group" aria-label="Forma de pagamento">
          <button type="button" aria-pressed={s.pay.mode === "cash"} onClick={() => s.setPay("mode", "cash")}>À vista</button>
          <button type="button" aria-pressed={s.pay.mode === "fin"} onClick={() => s.setPay("mode", "fin")}>Financiado</button>
        </div>
        {s.pay.mode === "fin" && (
          <>
            <div className="roi-grid">
              <NumInput label="Entrada" value={s.pay.entrada} min={0} suffix="%" onChange={(v) => s.setPay("entrada", v)} />
              <NumInput label="Prazo" value={s.pay.prazo} min={1} suffix="meses" onChange={(v) => s.setPay("prazo", v)} />
              <NumInput label="Taxa de juros" value={s.pay.taxa} min={0} suffix="%" onChange={(v) => s.setPay("taxa", v)} />
              <label className="roi-field">
                <span>Taxa ao</span>
                <select aria-label="Unidade da taxa" value={s.pay.unit} onChange={(e) => s.setPay("unit", e.target.value as "am" | "aa")}>
                  <option value="am">mês</option>
                  <option value="aa">ano</option>
                </select>
              </label>
            </div>
            <p className="roi-note">
              Entrada {money(m.plan.entrada)} · parcela {money(m.plan.parcela)} × {m.plan.n} · juros totais {money(m.plan.juros)}.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
