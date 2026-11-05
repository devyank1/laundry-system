import { useMemo } from "react";
import { TIERS, computeInsights, formatBRL0, mesesLabel, parseBR, verdictText, type InsightsInputs } from "./model";
import { useInsightsStore } from "./insightsStore";
import { PlantLink } from "../roi/PlantLink";
import { applyPlantToInsights, fleetDetailFromPlant, insightsMatchesPlant, usePlant } from "../plantLink";
import { Donut, LineChart } from "../roi/charts";
import { LINE, PIE, brlShort, type Slice } from "../roi/chartFormat";
import "../roi/roi.css";

function Text({
  label,
  hint,
  value,
  onChange,
  inputMode = "decimal",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label className="roi-field">
      <span>
        {label}
        {hint && <small> — {hint}</small>}
      </span>
      <span className="roi-input">
        <input type="text" inputMode={inputMode} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

function Line({ label, value, neg }: { label: string; value: string; neg?: boolean }) {
  return (
    <div className="roi-line">
      <span>{label}</span>
      <strong className={neg ? "roi-neg" : undefined}>{value}</strong>
    </div>
  );
}

export function InsightsCalculator() {
  const s = useInsightsStore();
  const inputs: InsightsInputs = useMemo(
    () => ({
      fleet: s.fleet, cycles: s.cycles, needplaca: s.needplaca, issues: s.issues, visitcost: s.visitcost, pct: s.pct,
      downdays: s.downdays, gwprice: s.gwprice, gwqty: s.gwqty, boardprice: s.boardprice, licprice: s.licprice,
    }),
    [s.fleet, s.cycles, s.needplaca, s.issues, s.visitcost, s.pct, s.downdays, s.gwprice, s.gwqty, s.boardprice, s.licprice],
  );
  const r = useMemo(() => computeInsights(inputs), [inputs]);
  const ok = r.verdict.kind === "ok";
  const plant = usePlant();
  const detail = useMemo(() => fleetDetailFromPlant(plant), [plant]);
  const neg = (n: number | null) => n !== null && n < 0;

  // --- Payback do hardware: resultado acumulado mês a mês (A = só hardware, B = + plano Completo)
  const capex = r.capex;
  const perMonth = r.annualRaw / 12;
  const pbX = capex !== null && perMonth > 0 ? capex / perMonth : null;
  const horizon = Math.min(120, Math.max(36, pbX ? Math.ceil((pbX * 1.25) / 12) * 12 : 36));
  const months = Array.from({ length: horizon + 1 }, (_, m) => m);
  const paySeries =
    capex !== null && r.bocas > 0
      ? [
          { label: "Só hardware (Gratuito)", values: months.map((m) => -capex + perMonth * m), style: LINE.main, main: true },
          ...(r.planA !== null
            ? [{ label: "Hardware + plano Completo", values: months.map((m) => -capex + ((r.annualRaw - (r.planA ?? 0)) / 12) * m), style: LINE.cons }]
            : []),
        ]
      : null;

  // --- Faturamento anual conforme os ciclos/dia de cada boca (hoje marcado)
  const weighted = TIERS.reduce((a, t) => a + (parseBR(s.fleet[t.id]) || 0) * t.rate, 0);
  const cyclesNow = parseBR(s.cycles) || 0;
  const maxC = Math.max(12, Math.ceil(cyclesNow * 1.5));
  const revSeries = weighted > 0 ? [{ label: "Faturamento anual", values: Array.from({ length: maxC + 1 }, (_, c) => c * weighted * 365), style: LINE.main, main: true }] : null;
  const cStep = maxC <= 12 ? 3 : maxC <= 24 ? 6 : 10;

  // --- Economia por ano (plano Gratuito) e bocas por tamanho
  const ecoSlices: Slice[] = [
    { label: "Visitas técnicas evitadas", value: r.visitSav ?? 0, color: PIE.c1, hint: "problemas resolvidos remotamente" },
    { label: "Receita recuperada", value: r.downRec ?? 0, color: PIE.c2, hint: "menos dias de máquina parada" },
  ];
  const tierColors = [PIE.c1, PIE.c2, PIE.c3, PIE.c4];
  const bocaSlices: Slice[] = TIERS.map((t, i) => ({
    label: t.label,
    value: parseBR(s.fleet[t.id]) || 0,
    color: tierColors[i] ?? PIE.c4,
    hint: `${formatBRL0(t.rate)} por ciclo`,
  }));
  const bocasFmt = (n: number) => `${n} ${n === 1 ? "boca" : "bocas"}`;

  return (
    <section className="roi" aria-label="Calculadora de conectividade">
      <header className="roi-head">
        <div>
          <h2>Retorno da conectividade</h2>
          <p>Quanto a conexão das máquinas economiza em visitas técnicas e máquina parada, e em quanto tempo o hardware se paga.</p>
        </div>
        <button type="button" onClick={() => window.confirm("Voltar tudo para os valores iniciais?") && s.reset()}>
          Restaurar padrões
        </button>
      </header>

      <PlantLink
        plant={plant}
        matches={insightsMatchesPlant(s.fleet, plant)}
        onApply={() => applyPlantToInsights(plant)}
        detail={`${r.bocas} boca(s) no cálculo · cada stack conta 2 (lavadora + secadora)`}
      />

      <div className="ins-dash">
        <div className="roi-card" data-testid="verdict">
          <div className="roi-card-head">
            <h3>Payback do hardware</h3>
            <span className="roi-card-total">{ok && r.verdict.kind === "ok" ? mesesLabel(r.verdict.months) : "—"}</span>
          </div>
          {paySeries ? (
            <LineChart
              W={760}
              H={230}
              ariaLabel="Resultado acumulado do hardware mês a mês"
              series={paySeries}
              xTicks={months.filter((m) => m % 12 === 0).map((m) => ({ i: m, label: m === 0 ? "início" : `${m / 12}º ano` }))}
              marker={pbX !== null && r.verdict.kind === "ok" ? { x: pbX, y: 0, label: `payback ${mesesLabel(r.verdict.months)}` } : null}
              tipTitle={(i) => (i === 0 ? "Início" : `Mês ${i}`)}
            />
          ) : null}
          <p className="roi-note">{verdictText(r.verdict)}</p>
        </div>

        <div className="roi-card">
          <div className="roi-card-head">
            <h3>Economia por ano</h3>
            <span className="roi-card-total">{formatBRL0(r.annual)}</span>
          </div>
          <Donut slices={ecoSlices} total={r.annualRaw} leadLabel="plano Gratuito"
            center={{ value: r.annualRaw > 0 ? brlShort.format(r.annualRaw) : "—", small: true }}
            caption="Economia por ano: visitas evitadas e receita recuperada" />
        </div>

        <div className="roi-card">
          <div className="roi-card-head">
            <h3>Faturamento anual (ref.)</h3>
            <span className="roi-card-total">{formatBRL0(r.annualRev)}</span>
          </div>
          {revSeries ? (
            <LineChart
              W={760}
              H={230}
              ariaLabel="Faturamento anual conforme os ciclos por dia de cada boca"
              series={revSeries}
              xTicks={Array.from({ length: Math.floor(maxC / cStep) + 1 }, (_, k) => ({ i: k * cStep, label: `${k * cStep}/dia` }))}
              marker={cyclesNow > 0 ? { x: Math.min(cyclesNow, maxC), y: r.annualRev ?? 0, label: `hoje: ${cyclesNow} ciclos/dia` } : null}
              tipTitle={(i) => `${i} ciclo(s)/dia por boca`}
            />
          ) : (
            <p className="roi-note">Preencha a frota para ver o faturamento.</p>
          )}
          <p className="roi-note">Quanto a loja fatura por ano conforme os ciclos por dia de cada boca.</p>
        </div>

        <div className="roi-card">
          <div className="roi-card-head">
            <h3>Total de bocas</h3>
            <span className="roi-card-total">{r.bocas || "—"}</span>
          </div>
          <Donut slices={bocaSlices} total={r.bocas} leadLabel={r.bocas === 1 ? "boca" : "bocas"} fmt={bocasFmt}
            center={{ value: String(r.bocas || "—") }}
            caption="Bocas por tamanho" />
        </div>
      </div>

      <div className="roi-main roi-main-even">
      <div className="roi-stack">

      <div className="roi-card">
        <h3>1 · O que o cliente tem</h3>
        <table className="roi-table">
          <thead>
            <tr><th>Tamanho da boca</th><th>R$/ciclo</th><th>Nº de bocas</th></tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t.id}>
                <td className="roi-name">
                  {t.label}
                  {detail[t.id].length > 0 && <small className="roi-name-desc">{detail[t.id].join(" · ")}</small>}
                </td>
                <td>{formatBRL0(t.rate)}</td>
                <td>
                  <input className="roi-name-input" type="text" inputMode="numeric" aria-label={`Nº de bocas — ${t.label}`} value={s.fleet[t.id]} onChange={(e) => s.setFleet(t.id, e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="roi-grid">
          <Text label="Ciclos/dia por boca" value={s.cycles} inputMode="numeric" onChange={(v) => s.setField("cycles", v)} />
          <Text label="Bocas que ainda precisam de placa" hint="máquinas dos últimos ~2 anos já vêm com placa" value={s.needplaca} inputMode="numeric" onChange={(v) => s.setField("needplaca", v)} />
        </div>
      </div>

      <div className="roi-card">
        <h3>2 · Serviço hoje</h3>
        <div className="roi-grid">
          <Text label="Problemas por máquina / ano" value={s.issues} onChange={(v) => s.setField("issues", v)} />
          <Text label="Custo por visita técnica (R$)" value={s.visitcost} onChange={(v) => s.setField("visitcost", v)} />
          <Text label="Dias de máquina parada por problema" value={s.downdays} onChange={(v) => s.setField("downdays", v)} />
          <label className="roi-field">
            <span>Problemas resolvíveis remotamente (reset / diagnóstico): {r.pctShown}%</span>
            <input type="range" min={0} max={100} step={5} aria-label="Problemas resolvíveis remotamente" value={s.pct} onChange={(e) => s.setField("pct", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="roi-card">
        <h3>3 · Preços</h3>
        <div className="roi-grid">
          <Text label="Gateway (R$)" value={s.gwprice} onChange={(v) => s.setField("gwprice", v)} />
          <Text label="Nº de gateways" value={s.gwqty} inputMode="numeric" onChange={(v) => s.setField("gwqty", v)} />
          <Text label="Placa · por boca (R$)" value={s.boardprice} onChange={(v) => s.setField("boardprice", v)} />
          <Text label="Licença mensal · por boca (R$)" hint="só no plano Completo" value={s.licprice} onChange={(v) => s.setField("licprice", v)} />
        </div>
      </div>

      </div>

      <div className="roi-stack roi-sticky">
      <div className="roi-card">
        <h3>Economia anual — plano Gratuito</h3>
        <div>
          <Line label="Visitas técnicas evitadas" value={formatBRL0(r.visitSav)} />
          <Line label="Receita recuperada (menos parada)" value={formatBRL0(r.downRec)} />
          <Line label="Economia anual" value={formatBRL0(r.annual)} />
        </div>
      </div>

      <div className="roi-pair">
      <div className="roi-card">
        <h3>Cenário A · só hardware (Gratuito)</h3>
        <div>
          <Line label="Investimento em hardware" value={formatBRL0(r.capex)} />
          <Line label="Payback do hardware" value={r.verdict.kind === "ok" ? mesesLabel(r.verdict.months) : "—"} />
          <Line label="Resultado líquido em 3 anos" value={formatBRL0(r.net3)} neg={neg(r.net3)} />
        </div>
        <p className="roi-note">Reset remoto, diagnóstico e monitoramento já vêm no plano Gratuito.</p>
      </div>

      <div className="roi-card">
        <h3>Cenário B · hardware + plano Completo</h3>
        <div>
          <Line label="Custo anual do plano" value={formatBRL0(r.planA)} />
          <Line label="Economia líquida por ano" value={formatBRL0(r.bNetYr)} neg={neg(r.bNetYr)} />
          <Line label="Resultado líquido em 3 anos" value={formatBRL0(r.bNet3)} neg={neg(r.bNet3)} />
        </div>
        <p className="roi-note">O plano Completo acrescenta relatórios avançados, API, retenção multi-ano e suporte por e-mail, chat e telefone.</p>
      </div>
      </div>

      </div>
      </div>

    </section>
  );
}
