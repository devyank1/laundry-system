import { useMemo, useState } from "react";
import { computeRoi, type RoiEquip, type RoiResult } from "./model";
import { useRoiStore } from "./roiStore";
import { PlantLink } from "./PlantLink";
import { applyPlantToRoi, roiMatchesPlant, usePlant } from "../plantLink";
import { Donut, LineChart } from "./charts";
import { LINE, PIE, brlShort, money, type Slice } from "./chartFormat";
import "./roi.css";



/** "Chassi grande 30, 2 × 13,6 kg (SSG30/SSU30) · 2 bocas (lavagem + secagem) · 2 cesto(s) por boca" */
function equipDesc(e: RoiEquip): string {
  if (e.descricao) return e.descricao;
  const bocas = e.wl + e.ws;
  const tipo = e.wl > 0 && e.ws > 0 ? "lavagem + secagem" : e.wl > 0 ? "lavagem" : "secagem";
  const partes = [e.modelo, `${bocas} ${bocas === 1 ? "boca" : "bocas"} (${tipo})`, `${e.cb} cesto(s) por boca`];
  return partes.filter(Boolean).join(" · ");
}
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

/** Caixa acumulado por cenário (realista = linha principal). */
function CashChart({ m }: { m: RoiResult }) {
  const styles = [LINE.cons, LINE.main, LINE.opt];
  const n = m.scen[0]?.series.length ? m.scen[0].series.length - 1 : 0;
  const years = Array.from({ length: Math.floor(n / 12) + 1 }, (_, k) => k * 12);
  return (
    <LineChart
      ariaLabel="Caixa acumulado ao longo do tempo"
      series={m.scen.map((sc, i) => ({ label: sc.label, values: sc.series, style: styles[i] ?? LINE.main, main: i === 1 }))}
      xTicks={years.map((mo) => ({ i: mo, label: mo === 0 ? "início" : `${mo / 12}º ano` }))}
      marker={m.pb !== null ? { x: m.pb, y: 0, label: `payback ${Math.round(m.pb)} meses` } : null}
      tipTitle={(i) => (i === 0 ? "Início" : `Mês ${i}`)}
    />
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
  const fixoMes = m.custoOp - m.full.varMes;
  const invSlices: Slice[] = [
    { label: "Equipamentos", value: m.equip, color: PIE.c1, hint: `${m.units} máquina(s)` },
    { label: "Infraestrutura", value: m.infra, color: PIE.c2 },
    ...(m.plan.mode === "fin" && m.plan.juros > 0
      ? [{ label: "Juros do financiamento", value: m.plan.juros, color: PIE.c4, hint: `${m.plan.n} parcelas` }]
      : []),
  ];
  const invTotal = invSlices.reduce((a, s) => a + s.value, 0);
  const recSlices: Slice[] = [
    { label: "Margem (lucro)", value: Math.max(0, m.full.margem), color: PIE.c1 },
    { label: "Custo variável", value: m.full.varMes, color: PIE.c2, hint: "química, água, energia" },
    { label: "Custo fixo", value: fixoMes, color: PIE.c3, hint: "aluguel, pessoal…" },
    { label: "Impostos", value: m.full.imp, color: PIE.c4 },
  ];
  // ROI anual: quanto do investimento a margem de 12 meses (plena) devolve
  const margemAno = m.full.margem * 12;
  const volta = Math.max(0, margemAno);
  const roiSlices: Slice[] = [
    { label: "Volta em 12 meses", value: Math.min(volta, m.inv), color: PIE.c1, hint: "margem do ano, operação plena" },
    { label: "Falta recuperar", value: Math.max(0, m.inv - volta), color: PIE.c2 },
  ];
  // Caixa no horizonte: o que a operação gera = investimento de volta + lucro
  const caixaSlices: Slice[] = [
    { label: "Lucro no caixa", value: Math.max(0, m.lucro), color: PIE.c1, hint: "cenário realista" },
    { label: "Paga o investimento", value: m.inv, color: PIE.c2 },
    ...(m.plan.mode === "fin" && m.plan.juros > 0
      ? [{ label: "Paga os juros", value: m.plan.juros, color: PIE.c4 }]
      : []),
  ];
  const caixaTotal = caixaSlices.reduce((a, x) => a + x.value, 0);

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

      <div className="roi-dash">
        <div className="roi-card roi-dash-chart">
          <div className="roi-card-head">
            <h3>Caixa acumulado</h3>
            <span>por cenário de uso</span>
          </div>
          <CashChart m={m} />
          <div className="roi-payback">
            <div className="roi-payback-main">
              <span>Payback (com rampa)</span>
              <strong>{months(m.pb)}</strong>
            </div>
            <div className="roi-payback-sub">
              <span>simples</span>
              <strong>{months(m.pbSimples)}</strong>
            </div>
          </div>
        </div>

        <div className="roi-dash-pies">
          <div className="roi-card">
            <div className="roi-card-head">
              <h3>Investimento total</h3>
              <span className="roi-card-total">{money(invTotal)}</span>
            </div>
            <Donut slices={invSlices} total={invTotal} leadLabel="em equipamentos"
              caption={m.plan.mode === "fin" ? "Investimento total com juros, por parte" : "Investimento total, por parte"} />
          </div>

          <div className="roi-card">
            <div className="roi-card-head">
              <h3>Receita do mês (plena)</h3>
              <span className="roi-card-total">{money(m.full.recMes)}</span>
            </div>
            <Donut slices={recSlices} total={m.full.recMes} leadLabel={m.full.margem > 0 ? "vira lucro" : "sem lucro"}
              caption="Receita mensal: lucro, custos e impostos" />
            {m.full.margem < 0 && <p className="roi-note roi-neg">Prejuízo de {money(-m.full.margem)}/mês: custos maiores que a receita.</p>}
          </div>

          <div className="roi-card">
            <div className="roi-card-head">
              <h3>ROI anual</h3>
              <span className="roi-card-total">{money(margemAno)}/ano</span>
            </div>
            <Donut slices={roiSlices} total={m.inv} leadLabel="ao ano"
              center={{ value: `${Math.round(m.roi)}%`, color: m.roi > 0 ? PIE.c1 : "var(--danger)" }}
              caption="ROI anual: parte do investimento que volta em 12 meses" />
          </div>

          <div className="roi-card">
            <div className="roi-card-head">
              <h3>Caixa em {m.anos} anos</h3>
              <span className="roi-card-total">{money(m.lucro)}</span>
            </div>
            <Donut slices={caixaSlices} total={caixaTotal} leadLabel={m.lucro > 0 ? "de lucro" : "ainda no vermelho"}
              center={{ value: brlShort.format(m.lucro), small: true, color: m.lucro > 0 ? PIE.c1 : "var(--danger)" }}
              caption={`Caixa em ${m.anos} anos: lucro e investimento pago`} />
          </div>
        </div>

        <div className="roi-card roi-dash-wide">
          <div className="roi-card-head">
            <h3>Resumo</h3>
          </div>
          <div className="roi-dash-summary">
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
          </div>
          <p className="roi-note">Ciclos por boca por dia em cada cenário.</p>
        </div>
      </div>

      <h3 className="roi-section-title">Premissas</h3>
      <div className="roi-inputs">
      <div className="roi-card roi-card-wide">
        <h3>Equipamentos</h3>
        {s.equip.map((e, i) => (
          <div className="roi-row" key={i}>
            <span className="roi-name">
              {e.nome}
              <small className="roi-name-desc">{equipDesc(e)}</small>
            </span>
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
