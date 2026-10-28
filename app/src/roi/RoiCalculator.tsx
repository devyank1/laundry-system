import { useMemo, useState, type PointerEvent } from "react";
import { computeRoi, type RoiResult } from "./model";
import { useRoiStore } from "./roiStore";
import { PlantLink } from "./PlantLink";
import { applyPlantToRoi, roiMatchesPlant, usePlant } from "../plantLink";
import "./roi.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const money = (v: number) => brl.format(Math.round(v));
const months = (v: number | null) => (v === null ? "—" : `${Math.round(v)} meses`);

/** Campo numérico que aceita vírgula e deixa apagar o conteúdo enquanto se digita. */
function NumInput({
  label,
  shortLabel,
  value,
  onChange,
  suffix,
  min,
}: {
  label: string;
  /** rótulo visível curto (ex.: "Preço" numa linha que já mostra o nome); "" = sem rótulo (lista com cabeçalho) */
  shortLabel?: string;
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
      {shortLabel !== "" && <span>{shortLabel ?? label}</span>}
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

function Stat({ label, value, hint, featured }: { label: string; value: string; hint?: string; featured?: boolean }) {
  return (
    <div className={featured ? "roi-stat roi-stat-featured" : "roi-stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

// Cenários ordenados (pior → melhor): um só tom, do claro ao escuro; o
// realista (o principal) é o mais forte. Tracejado no conservador pra não
// depender só da cor.
const SCEN_STYLE = [
  { color: "#7fa7c4", width: 1.75, dash: "5 4" },
  { color: "#0b3d59", width: 2.5, dash: undefined },
  { color: "#3f78a0", width: 1.75, dash: undefined },
];
const scenStyle = (i: number) => SCEN_STYLE[i] ?? SCEN_STYLE[1];

// Até ~5 marcas "redondas" no eixo y (50 mil, 100 mil, 250 mil...).
function niceTicks(lo: number, hi: number, count = 5): number[] {
  const raw = (hi - lo || 1) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

const thousands = (v: number) => (Math.abs(v) < 1 ? "0" : `${int.format(Math.round(v / 1000))} mil`);

function CashChart({ m }: { m: RoiResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 300;
  const pad = { l: 64, r: 92, t: 16, b: 30 };
  const all = m.scen.flatMap((sc) => sc.series);
  if (all.length < 2) return null;
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const lo = Math.min(ticks[0], ...all);
  const hi = Math.max(ticks[ticks.length - 1], ...all);
  const n = m.scen[0].series.length - 1;
  const x = (i: number) => pad.l + (i / Math.max(1, n)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const path = (sr: number[]) => sr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const years = Array.from({ length: Math.floor(n / 12) + 1 }, (_, k) => k * 12);
  // Rótulos diretos no fim de cada linha, afastados pra não encostar.
  const ends = m.scen.map((sc, i) => ({ i, y: y(sc.series[n]) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 14);

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * n);
    setHover(i < 0 || i > n ? null : i);
  }

  const tipX = hover === null ? 0 : x(hover);
  const tipLeft = tipX > W - pad.r - 170;

  return (
    <div className="roi-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="roi-chart"
        role="img"
        aria-label="Caixa acumulado ao longo do tempo"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={Math.abs(t) < 1 ? "roi-axis-zero" : "roi-grid-line"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="roi-tick">{thousands(t)}</text>
          </g>
        ))}
        {years.map((mo) => (
          <text key={mo} x={x(mo)} y={H - 8} textAnchor="middle" className="roi-tick">
            {mo === 0 ? "início" : `ano ${mo / 12}`}
          </text>
        ))}
        {m.scen.map((sc, i) => {
          const st = scenStyle(i);
          return (
            <path key={sc.label} d={path(sc.series)} fill="none" stroke={st.color} strokeWidth={st.width}
              strokeDasharray={st.dash} strokeLinejoin="round" strokeLinecap="round" />
          );
        })}
        {ends.map(({ i, y: ly }) => (
          <text key={i} x={W - pad.r + 8} y={ly + 4} className="roi-end-label">{m.scen[i].label}</text>
        ))}
        {m.pb !== null && m.pb <= n && (
          <g>
            <circle cx={x(m.pb)} cy={y(0)} r="5" fill={SCEN_STYLE[1].color} stroke="var(--surface)" strokeWidth="2" />
            <text x={x(m.pb)} y={y(0) - 12} textAnchor="middle" className="roi-pb-label">
              payback {Math.round(m.pb)} meses
            </text>
          </g>
        )}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={tipX} x2={tipX} y1={pad.t} y2={H - pad.b} className="roi-crosshair" />
            {m.scen.map((sc, i) => (
              <circle key={sc.label} cx={tipX} cy={y(sc.series[hover])} r="4" fill={scenStyle(i).color}
                stroke="var(--surface)" strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="roi-tooltip"
          style={{ left: `${(tipX / W) * 100}%`, transform: tipLeft ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
        >
          <b>{hover === 0 ? "Início" : `Mês ${hover}`}</b>
          {m.scen.map((sc, i) => (
            <span key={sc.label}>
              <i style={{ background: scenStyle(i).color }} />
              {sc.label}
              <em className={sc.series[hover] < 0 ? "roi-neg" : undefined}>{money(sc.series[hover])}</em>
            </span>
          ))}
        </div>
      )}
      <ul className="roi-legend">
        {m.scen.map((sc, i) => {
          const st = scenStyle(i);
          return (
            <li key={sc.label}>
              <svg width="22" height="8" aria-hidden="true">
                <line x1="1" x2="21" y1="4" y2="4" stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinecap="round" />
              </svg>
              {sc.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="roi-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function RoiCalculator() {
  const s = useRoiStore();
  const state = useMemo(
    () => ({ equip: s.equip, infra: s.infra, fixo: s.fixo, op: s.op, cost: s.cost, pay: s.pay }),
    [s.equip, s.infra, s.fixo, s.op, s.cost, s.pay],
  );
  const m = useMemo(() => computeRoi(state), [state]);
  const plant = usePlant();

  return (
    <section className="roi" aria-label="Calculadora de retorno">
      <header className="roi-head">
        <div>
          <h2>Retorno do investimento</h2>
          <p>Quanto a loja custa, quanto rende por mês e quando se paga. Ajuste as premissas abaixo.</p>
        </div>
        <button type="button" onClick={() => window.confirm("Voltar tudo para os valores iniciais?") && s.reset()}>
          Restaurar valores iniciais
        </button>
      </header>

      <PlantLink
        plant={plant}
        matches={roiMatchesPlant(s.equip, plant)}
        onApply={() => applyPlantToRoi(plant)}
        detail={`${m.units} equipamento(s) no cálculo`}
      />

      <div className="roi-results">
        <Stat featured label="Payback (com rampa)" value={months(m.pb)} hint={m.pbSimples === null ? undefined : `simples: ${months(m.pbSimples)}`} />
        <Stat label="Investimento total" value={money(m.inv)} hint={`equipamentos ${money(m.equip)} + infra ${money(m.infra)}`} />
        <Stat label="Margem mensal (plena)" value={money(m.full.margem)} hint={`receita ${money(m.full.recMes)}`} />
        <Stat label="ROI anual" value={`${Math.round(m.roi)}%`} hint="margem do ano ÷ investimento" />
        <Stat label={`Caixa em ${m.anos} anos`} value={money(m.lucro)} hint="cenário realista" />
      </div>

      <div className="roi-main">
        <div className="roi-card">
          <div className="roi-card-head">
            <h3>Caixa acumulado</h3>
            <span>por cenário de uso das máquinas</span>
          </div>
          <CashChart m={m} />
        </div>

        <div className="roi-card">
          <div className="roi-card-head">
            <h3>Resumo</h3>
          </div>
          <div>
            <Line label={`Receita no mês 1 (${Math.round(m.util1 * 100)}% de ocupação)`} value={money(m.rev1)} />
            <Line label="Receita do 1º ano" value={money(m.revY1)} />
            <Line label="Custo operacional mensal" value={money(m.custoOp)} />
            <Line label="Impostos por mês" value={money(m.full.imp)} />
          </div>
          <table className="roi-table">
            <thead>
              <tr><th>Cenário</th><th>Ciclos</th><th>Margem/mês</th><th>Payback</th></tr>
            </thead>
            <tbody>
              {m.scen.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td><td>{c.ciclos}</td><td>{money(c.margem)}</td><td>{months(c.pb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="roi-note">Ciclos por boca por dia em cada cenário.</p>
        </div>
      </div>

      <h3 className="roi-section-title">Premissas</h3>
      <div className="roi-inputs">
      <div className="roi-card roi-card-wide">
        <h3>Equipamentos</h3>
        {s.equip.map((e, i) => (
          <div className="roi-row" key={i}>
            <span className="roi-name">{e.nome}</span>
            <NumInput label={`Preço — ${e.nome}`} shortLabel="Preço unitário" value={e.preco} min={0} suffix="R$" onChange={(v) => s.setEquip(i, { preco: v })} />
            <NumInput label={`Quantidade — ${e.nome}`} shortLabel="Quantidade" value={e.qtd} min={0} onChange={(v) => s.setEquip(i, { qtd: v })} />
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
          <div className="roi-list">
            <div className="roi-list-row roi-list-fixo roi-list-head" aria-hidden="true">
              <span>Item</span>
              <span>Valor mensal</span>
              <span />
            </div>
            {s.fixo.map((f, i) => (
              <div className="roi-list-row roi-list-fixo" key={i}>
                <input className="roi-name-input" aria-label={`Nome do custo fixo ${i + 1}`} value={f.nome} title={f.nome} onChange={(e) => s.setFixo(i, { nome: e.target.value })} />
                <NumInput label={`Valor — ${f.nome}`} shortLabel="" value={f.val} min={0} suffix="R$" onChange={(v) => s.setFixo(i, { val: v })} />
                <button type="button" className="roi-remove" aria-label={`Remover ${f.nome}`} title="Remover" onClick={() => s.removeFixo(i)}>×</button>
              </div>
            ))}
          </div>
          <button type="button" className="roi-add" onClick={s.addFixo}>+ custo fixo</button>
        </details>
      </div>

      <div className="roi-card roi-card-wide roi-card-last">
        <h3>Infraestrutura</h3>
        <p className="roi-note">Itens “por máquina” são multiplicados pelo nº de equipamentos ({m.units}). Total: {money(m.infra)}.</p>
        <details>
          <summary>Detalhar itens</summary>
          {/* Lista longa: em duas colunas, cada uma com o seu cabeçalho */}
          <div className="roi-list-cols">
            {[s.infra.slice(0, Math.ceil(s.infra.length / 2)), s.infra.slice(Math.ceil(s.infra.length / 2))].map((half, col) => {
              const offset = col === 0 ? 0 : Math.ceil(s.infra.length / 2);
              if (half.length === 0) return null;
              return (
                <div className="roi-list" key={col}>
                  <div className="roi-list-row roi-list-infra roi-list-head" aria-hidden="true">
                    <span>Item</span>
                    <span>Tipo</span>
                    <span>Valor</span>
                    <span>Total</span>
                    <span />
                  </div>
                  {half.map((it, k) => {
                    const i = offset + k;
                    return (
                      <div className="roi-list-row roi-list-infra" key={i}>
                        <input className="roi-name-input" aria-label={`Nome do item de infra ${i + 1}`} value={it.nome} title={it.nome} onChange={(e) => s.setInfra(i, { nome: e.target.value })} />
                        <select aria-label={`Tipo — ${it.nome}`} value={it.tipo} onChange={(e) => s.setInfra(i, { tipo: e.target.value as "fixo" | "maq" })}>
                          <option value="fixo">Fixo</option>
                          <option value="maq">Por máquina</option>
                        </select>
                        <NumInput label={`Valor — ${it.nome}`} shortLabel="" value={it.val} min={0} suffix="R$" onChange={(v) => s.setInfra(i, { val: v })} />
                        <span className="roi-sub">{money(m.infraRows[i] ?? 0)}</span>
                        <button type="button" className="roi-remove" aria-label={`Remover ${it.nome}`} title="Remover" onClick={() => s.removeInfra(i)}>×</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <button type="button" className="roi-add" onClick={s.addInfra}>+ item de infra</button>
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
      </div>
    </section>
  );
}
