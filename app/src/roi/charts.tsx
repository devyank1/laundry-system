import { useId, useState, type PointerEvent } from "react";
import { money, thousands, type LineStyle, type Slice } from "./chartFormat";

// Gráficos do painel (ROI e Conectividade): linha com guia/etiqueta e rosca
// fina com legenda. Cores vêm do tema (variáveis --chart-* e --line-* do
// index.css), aplicadas via style porque atributo SVG não aceita var().

// Até ~5 marcas "redondas" no eixo y (50 mil, 100 mil, 250 mil...).
function niceTicks(lo: number, hi: number, count = 5): number[] {
  const raw = (hi - lo || 1) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

export interface LineSeries {
  label: string;
  values: number[];
  style: LineStyle;
  /** desenhada por cima, com degradê */
  main?: boolean;
}

/**
 * Gráfico de linha quadrado: grade recessiva, guia tracejada com etiqueta
 * (sem marcador na linha), mira + dica no hover, legenda embaixo.
 */
export function LineChart({
  series,
  xTicks,
  marker,
  ariaLabel,
  tipTitle,
  valueFmt = money,
  yFmt = thousands,
  W = 420,
  H = 380,
}: {
  series: LineSeries[];
  xTicks: { i: number; label: string }[];
  /** guia vertical em x (índice, pode ser fracionário) até o valor y */
  marker?: { x: number; y: number; label: string } | null;
  ariaLabel: string;
  tipTitle: (i: number) => string;
  valueFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  W?: number;
  H?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = `lg${useId().replace(/:/g, "")}`;
  const pad = { l: 58, r: 26, t: 16, b: 30 };
  const all = series.flatMap((s) => s.values);
  if (all.length < 2) return null;
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const lo = Math.min(ticks[0], ...all);
  const hi = Math.max(ticks[ticks.length - 1], ...all);
  const n = series[0].values.length - 1;
  const x = (i: number) => pad.l + (i / Math.max(1, n)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const path = (sr: number[]) => sr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * n);
    setHover(i < 0 || i > n ? null : i);
  }

  const tipX = hover === null ? 0 : x(hover);
  const tipLeft = tipX > W / 2;
  const pillW = marker ? Math.max(90, marker.label.length * 6.2 + 16) : 0;
  const pillX = marker ? Math.min(W - pad.r - pillW, Math.max(pad.l, x(marker.x) - pillW / 2)) : 0;
  // principal por último, por cima das outras
  const order = [...series].sort((a, b) => Number(!!a.main) - Number(!!b.main));

  return (
    <div className="roi-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="roi-chart" role="img" aria-label={ariaLabel}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={Math.abs(t) < 1 ? "roi-axis-zero" : "roi-grid-line"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="roi-tick">{yFmt(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.i} x={x(t.i)} y={H - 8} textAnchor="middle" className="roi-tick">{t.label}</text>
        ))}
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={pad.l} y1="0" x2={W - pad.r} y2="0">
            <stop offset="0" style={{ stopColor: "var(--line-main-from)" }} />
            <stop offset="1" style={{ stopColor: "var(--line-main)" }} />
          </linearGradient>
        </defs>
        {marker && marker.x >= 0 && marker.x <= n && (
          <g pointerEvents="none">
            <line x1={x(marker.x)} x2={x(marker.x)} y1={pad.t + 22} y2={y(marker.y)} className="roi-pb-guide" />
            <rect x={pillX} y={pad.t} width={pillW} height="20" rx="6" className="roi-pb-pill" />
            <text x={pillX + pillW / 2} y={pad.t + 14} textAnchor="middle" className="roi-pb-label">{marker.label}</text>
          </g>
        )}
        {order.map((s) => (
          <path key={s.label} d={path(s.values)} fill="none" style={{ stroke: s.main ? `url(#${gid})` : s.style.color }}
            strokeWidth={s.style.width} strokeDasharray={s.style.dash} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={tipX} x2={tipX} y1={pad.t} y2={H - pad.b} className="roi-crosshair" />
            {series.map((s) => (
              <circle key={s.label} cx={tipX} cy={y(s.values[hover])} r="3.5"
                style={{ fill: "var(--surface)", stroke: s.style.color }} strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="roi-tooltip"
          style={{ left: `${(tipX / W) * 100}%`, transform: tipLeft ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}>
          <b>{tipTitle(hover)}</b>
          {series.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.style.color }} />
              {s.label}
              <em className={s.values[hover] < 0 ? "roi-neg" : undefined}>{valueFmt(s.values[hover])}</em>
            </span>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <ul className="roi-legend">
          {series.map((s) => (
            <li key={s.label}>
              <svg width="22" height="8" aria-hidden="true">
                <line x1="1" x2="21" y1="4" y2="4" style={{ stroke: s.style.color }} strokeWidth={s.style.width}
                  strokeDasharray={s.style.dash} strokeLinecap="round" />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RING_R = 76;
const RING_W = 10;
const RING_C = 2 * Math.PI * RING_R;
const RING_GAP = RING_W + 7; // pontas arredondadas + respiro entre fatias

/**
 * Anel fino: a 1ª fatia (a principal) em degradê, as outras
 * sólidas; % da principal grande no meio. Passar o mouse numa fatia ou na
 * legenda troca o centro pra ela.
 */
export function Donut({
  slices,
  total,
  caption,
  leadLabel,
  center,
  fmt = money,
}: {
  slices: Slice[];
  total: number;
  caption: string;
  leadLabel: string;
  /** centro sem hover no lugar da % da 1ª fatia (ex.: ROI 97%, "R$ 1,06 mi") */
  center?: { value: string; color?: string; small?: boolean };
  /** valor de cada fatia na legenda/hover (padrão: reais) */
  fmt?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");
  const shown = slices.filter((s) => s.value > 0);
  const sum = shown.reduce((a, s) => a + s.value, 0) || 1;
  const base = total || sum;
  const pct = (v: number) => `${Math.round((v / base) * 100)}%`;
  const gap = shown.length > 1 ? RING_GAP : 0;
  const arcs = shown.map((s, i) => {
    const before = shown.slice(0, i).reduce((a, x) => a + x.value, 0);
    const start = (before / sum) * RING_C;
    const len = Math.max(0.01, (s.value / sum) * RING_C - gap);
    return { s, start: start + gap / 2, len };
  });
  // Degradê da principal ao longo do arco: cauda apagada, ponta acesa
  // (coordenadas antes do rotate(-90): ângulo 0 = topo)
  const at = (len: number, r = RING_R) => {
    const t = len / RING_R;
    return { x: 100 + r * Math.cos(t), y: 100 + r * Math.sin(t) };
  };
  const g0 = arcs[0] ? at(arcs[0].start) : { x: 0, y: 0 };
  const g1 = arcs[0] ? at(arcs[0].start + Math.min(arcs[0].len, RING_C / 2)) : { x: 0, y: 1 };
  const focus = hover ?? 0;
  const f = shown[focus];
  const ring = (start: number, len: number) => ({
    cx: 100,
    cy: 100,
    r: RING_R,
    fill: "none",
    strokeDasharray: `${len} ${RING_C}`,
    strokeDashoffset: -start,
    transform: "rotate(-90 100 100)",
  });
  return (
    <div className="roi-donut">
      <svg viewBox="0 0 200 200" role="img" aria-label={caption} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`g${uid}`} gradientUnits="userSpaceOnUse" x1={g0.x} y1={g0.y} x2={g1.x} y2={g1.y}>
            <stop offset="0" style={{ stopColor: shown[0]?.color, stopOpacity: 0.3 }} />
            <stop offset="1" style={{ stopColor: shown[0]?.color }} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={RING_R} fill="none" strokeWidth={RING_W} className="roi-ring-track" />
        {arcs.map(({ s, start, len }, i) => (
          <circle key={s.label} {...ring(start, len)} style={{ stroke: i === 0 ? `url(#g${uid})` : s.color }} strokeWidth={RING_W}
            strokeLinecap={shown.length > 1 ? "round" : "butt"}
            className={hover !== null && hover !== i ? "roi-donut-dim" : undefined} />
        ))}
        {/* área de toque mais larga que o traço */}
        {arcs.map(({ s, start, len }, i) => (
          <circle key={`hit-${s.label}`} {...ring(start - gap / 2, len + gap)} stroke="transparent" strokeWidth="30"
            pointerEvents="stroke" onPointerEnter={() => setHover(i)} />
        ))}
        {hover === null && center ? (
          <text x="100" y="104" textAnchor="middle" className={center.small ? "roi-donut-pct roi-donut-pct-sm" : "roi-donut-pct"}
            style={{ fill: center.color ?? shown[0]?.color ?? "var(--text-muted)" }}>
            {center.value}
          </text>
        ) : (
          <text x="100" y="104" textAnchor="middle" className="roi-donut-pct" style={{ fill: f ? f.color : "var(--text-muted)" }}>
            {f ? pct(f.value) : "—"}
          </text>
        )}
        <text x="100" y="124" textAnchor="middle" className="roi-donut-label">
          {hover === null ? leadLabel : f?.label}
        </text>
        {hover !== null && f && (
          <text x="100" y="139" textAnchor="middle" className="roi-donut-sub">{fmt(f.value)}</text>
        )}
      </svg>
      <ul className="roi-donut-legend">
        {slices.map((s) => {
          const i = shown.indexOf(s);
          return (
            <li key={s.label} className={hover !== null && hover === i ? "is-hover" : undefined}
              onPointerEnter={() => setHover(i < 0 ? null : i)} onPointerLeave={() => setHover(null)}>
              <i style={{ background: s.color }} />
              <span>
                {s.label}
                {s.hint && <small>{s.hint}</small>}
              </span>
              <strong>{fmt(s.value)}</strong>
              <em>{s.value > 0 ? pct(s.value) : "—"}</em>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
