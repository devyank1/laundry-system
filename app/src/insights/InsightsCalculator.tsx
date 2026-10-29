import { useMemo } from "react";
import { TIERS, computeInsights, formatBRL0, mesesLabel, verdictText, type InsightsInputs } from "./model";
import { useInsightsStore } from "./insightsStore";
import { PlantLink } from "../roi/PlantLink";
import { applyPlantToInsights, fleetDetailFromPlant, insightsMatchesPlant, usePlant } from "../plantLink";
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

      <div className="roi-results">
        <div className="roi-stat roi-stat-featured roi-stat-wide" data-testid="verdict">
          <span>Payback do hardware</span>
          <strong>{ok && r.verdict.kind === "ok" ? mesesLabel(r.verdict.months) : "—"}</strong>
          <small>{verdictText(r.verdict)}</small>
        </div>
        <div className="roi-stat">
          <span>Economia por ano</span>
          <strong>{formatBRL0(r.annual)}</strong>
          <small>plano Gratuito</small>
        </div>
        <div className="roi-stat">
          <span>Total de bocas</span>
          <strong>{r.bocas || "—"}</strong>
        </div>
        <div className="roi-stat">
          <span>Faturamento anual (ref.)</span>
          <strong>{formatBRL0(r.annualRev)}</strong>
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

      <details className="roi-card roi-assumptions">
        <summary>Premissas do cálculo</summary>
        <p className="roi-note">Receita: ciclos/dia × R$/ciclo por boca, somado em todas as bocas, × 365 dias.</p>
        <p className="roi-note">Economia anual: (problemas/ano × % resolvível × custo por visita) + (problemas resolvíveis × dias de parada × faturamento por boca/dia). Só problemas resolvidos remotamente contam como parada evitada.</p>
        <p className="roi-note">Payback: investimento em hardware ÷ economia mensal, arredondado para cima em meses inteiros.</p>
        <p className="roi-note">Estimativa de apoio à decisão: os valores dependem dos dados informados e não garantem resultado.</p>
      </details>
    </section>
  );
}
