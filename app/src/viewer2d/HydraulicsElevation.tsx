import type { ReactNode } from "react";
import type { Layout } from "../engine/types";
import { CAD, formatMeters } from "./planTheme";

// "ÁGUA FRIA E ESGOTO — VISTA 01": a parede de trás vista do salão (como na
// prancha RP072-26-HID), com as máquinas só em silhueta tracejada pra
// mostrar o que fica atrás delas: barramento de água no piso subindo em cada
// lavadora (registro + T), tubo de esgoto com i=2% e os tubos de dreno.

const PUMP_W_MM = 300;
const PUMP_H_MM = 330;
const PUMP_BASE_MM = 60;
const CHAIN_GAP = 12; // px entre o desenho e a corrente de cotas
const STANDPIPE_MIN = 50; // tubo de dreno: no mínimo Ø50
// A vista é cortada um pouco acima dos pontos (linha de interrupção): tudo
// que interessa fica abaixo de ~1,4 m e o resto da parede é só papel.
export const ELEVATION_VISIBLE_MM = 1150;
export const ELEVATION_SCALE = 0.17; // px por mm (mais que a planta, como o detalhe 1:25)
const WALL_MM = 150;

// Largura total da vista em px (paredes em corte + cotas à esquerda).
export function elevationWidthPx(alongMm: number, scale: number): number {
  return alongMm * scale + 2 * WALL_MM * scale + 50;
}

// Bitolas comerciais de PVC (esgoto) — a vista mostra o tubo que se compra.
const PVC_SEWER_MM = [40, 50, 75, 100, 150];
export function pvcSewer(dMm: number): number {
  return PVC_SEWER_MM.find((d) => d >= dMm - 2) ?? PVC_SEWER_MM[PVC_SEWER_MM.length - 1];
}

function Txt({
  x,
  y,
  size,
  fill = CAD.ink,
  anchor = "middle",
  rotate = 0,
  weight = 400,
  children,
}: {
  x: number;
  y: number;
  size: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  rotate?: number;
  weight?: number;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fill={fill}
      textAnchor={anchor}
      fontWeight={weight}
      stroke={CAD.paper}
      strokeWidth={size / 4}
      paintOrder="stroke"
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >
      {children}
    </text>
  );
}

// Cota com valor em caixinha (padrão das pranchas).
function Dim({ x0, y0, x1, y1, text }: { x0: number; y0: number; x1: number; y1: number; text: string }) {
  const vertical = Math.abs(x0 - x1) < 0.01;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const size = 5;
  const bw = text.length * size * 0.6 + 3;
  const len = Math.hypot(x1 - x0, y1 - y0);
  return (
    <g data-dimension>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={CAD.ink} strokeWidth={0.35} />
      {[
        [x0, y0],
        [x1, y1],
      ].map(([x, y], i) => (
        <line key={i} x1={x - 2.4} y1={y + 2.4} x2={x + 2.4} y2={y - 2.4} stroke={CAD.ink} strokeWidth={0.6} />
      ))}
      {len > bw * 0.55 && (
        <g transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined}>
          <rect x={mx - bw / 2} y={my - size - 1} width={bw} height={size + 2} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.35} />
          <text x={mx} y={my - 1.5} fontSize={size} textAnchor="middle" fill={CAD.ink}>
            {text}
          </text>
        </g>
      )}
    </g>
  );
}

export function elevationHeightPx(layout: Layout, scale: number): number {
  // desenho (piso → forro) + cotas em cima e embaixo + título
  return Math.min(layout.ceilingHeightMm, ELEVATION_VISIBLE_MM) * scale + 92;
}

export function HydraulicsElevation({
  layout,
  scale,
  flip,
}: {
  layout: Layout;
  scale: number;
  // true quando, olhando do salão pra parede das máquinas, o "along" corre
  // da direita pra esquerda (fileira na parede esquerda em orientation=side).
  flip: boolean;
}) {
  const h = layout.hydraulics;
  if (!h) return null;
  const isSide = layout.orientation === "side";
  const L = isSide ? layout.roomDepthMm : layout.roomWidthMm;
  const top = 22; // espaço da corrente de cotas da água
  const W = L * scale;
  const visibleMm = Math.min(layout.ceilingHeightMm, ELEVATION_VISIBLE_MM);
  const H = visibleMm * scale;
  const clipId = `elev-clip-${Math.round(L)}-${Math.round(scale * 1000)}`;
  const X = (a: number) => (flip ? L - a : a) * scale;
  const Y = (y: number) => top + H - y * scale;
  const s = (mm: number) => mm * scale;
  const wall = s(WALL_MM);
  // linha de interrupção (zigue-zague) no topo do corte
  const breakLine = (x0: number, x1: number) => {
    const mid = (x0 + x1) / 2;
    return `M${x0} ${top} H${mid - 4} L${mid - 2} ${top - 4} L${mid + 2} ${top + 4} L${mid + 4} ${top} H${x1}`;
  };

  const arrow = (x0: number, y0: number, x1: number, y1: number, color: string, key?: string) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 10) return null;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const a = 2.4;
    return (
      <path
        key={key}
        d={`M${mx + ux * a} ${my + uy * a} L${mx - ux * a - uy * a * 0.7} ${my - uy * a + ux * a * 0.7} L${mx - ux * a + uy * a * 0.7} ${my - uy * a - ux * a * 0.7} Z`}
        fill={color}
      />
    );
  };
  // Tubo em linha dupla (contorno com a bitola) + eixo tracejado, como no CAD.
  const tubeH = (a0: number, a1: number, y: number, dia: number, color: string, key?: string) => {
    const x0 = Math.min(X(a0), X(a1));
    const x1 = Math.max(X(a0), X(a1));
    const t = Math.max(1.6, s(dia));
    return (
      <g key={key}>
        <rect x={x0} y={Y(y) - t / 2} width={x1 - x0} height={t} fill={CAD.paper} stroke={color} strokeWidth={0.5} />
        <line x1={x0} y1={Y(y)} x2={x1} y2={Y(y)} stroke={color} strokeWidth={0.3} strokeDasharray="3 1.5" />
      </g>
    );
  };
  const tubeV = (a: number, y0: number, y1: number, dia: number, color: string, key?: string) => {
    const t = Math.max(1.6, s(dia));
    return (
      <g key={key}>
        <rect x={X(a) - t / 2} y={Y(Math.max(y0, y1))} width={t} height={Math.abs(y1 - y0) * scale} fill={CAD.paper} stroke={color} strokeWidth={0.5} />
        <line x1={X(a)} y1={Y(y0)} x2={X(a)} y2={Y(y1)} stroke={color} strokeWidth={0.3} strokeDasharray="3 1.5" />
      </g>
    );
  };

  // --- Água ---------------------------------------------------------------
  const manY = h.manifold.points[0].y;
  const manDia = h.manifold.diameterMm;
  const risers = h.washers.map((w) => w.water.riser[0].a);
  const waterStops = Array.from(new Set([h.pump.a, ...risers])).sort((p, q) => p - q);
  const teeY = h.washers[0].water.riser[1].y;

  // --- Esgoto -------------------------------------------------------------
  const drainSegs = h.drainLine.filter((sg) => Math.abs(sg.points[1].a - sg.points[0].a) > 1);
  const drainY = h.drainLine[0].points[0].y;
  const exitA = h.sewerExit.inside.a;
  const exitDia = h.sewerExit.diameterMm;
  const standTop = h.washers[0].standpipe.topY;
  const sewerStops = Array.from(new Set([...h.washers.map((w) => w.standpipe.a), exitA])).sort((p, q) => p - q);

  const first = [...h.washers].sort((p, q) => X(p.a) - X(q.a))[0];
  const dimX = Math.min(X(first.water.riser[0].a), X(first.standpipe.a)) - 10;

  return (
    <g data-elevation fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Parede de trás, laterais em corte, piso e forro */}
      <defs>
        <clipPath id={clipId}>
          <rect x={-wall} y={top} width={W + 2 * wall} height={H + 40} />
        </clipPath>
      </defs>
      <path d={breakLine(-wall, W + wall)} stroke={CAD.ink} strokeWidth={0.5} />
      <line x1={0} y1={top} x2={0} y2={top + H} stroke={CAD.ink} strokeWidth={0.4} />
      <line x1={W} y1={top} x2={W} y2={top + H} stroke={CAD.ink} strokeWidth={0.4} />
      <rect x={-wall} y={top} width={wall} height={H + 4} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.6} />
      <rect x={W} y={top} width={wall} height={H + 4} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.6} />
      <g clipPath={`url(#${clipId})`}>
      <line x1={-wall} y1={top + H} x2={W + wall} y2={top + H} stroke={CAD.ink} strokeWidth={1} />
      <line x1={-wall} y1={top + H + 4} x2={W + wall} y2={top + H + 4} stroke={CAD.ink} strokeWidth={0.4} />
      <Txt x={W - 4} y={top + 9} size={5.5} fill={CAD.roomLabel} anchor="end">
        {`FORRO DE GESSO h=${formatMeters(layout.ceilingHeightMm)}m ↑`}
      </Txt>

      {/* Máquinas em silhueta (estão na frente dos tubos) */}
      {layout.machines.map((m, i) => {
        const a0 = isSide ? m.y : m.x;
        const a1 = a0 + (isSide ? m.depthMm : m.widthMm);
        const x0 = Math.min(X(a0), X(a1));
        const x1 = Math.max(X(a0), X(a1));
        return (
          <g key={i} stroke={CAD.gray} strokeWidth={0.4}>
            {m.baseMm > 0 && <rect x={x0 - s(20)} y={Y(m.baseMm)} width={x1 - x0 + s(40)} height={s(m.baseMm)} fill="#d1d5db" />}
            <rect x={x0} y={Y(m.baseMm + m.heightMm)} width={x1 - x0} height={s(m.heightMm)} strokeDasharray="3 2" />
            <Txt x={(x0 + x1) / 2} y={Y(m.baseMm + m.heightMm) + 8} size={6} fill={CAD.gray}>
              {`T${i + 1}`}
            </Txt>
          </g>
        );
      })}

      {/* ESGOTO: tubo no piso com i=2% rumo à saída, tubos de dreno subindo */}
      <g data-elevation-sewer>
        {drainSegs.map((sg, i) => {
          const [p, q] = sg.points;
          return (
            <g key={i}>
              {tubeH(p.a, q.a, drainY, sg.diameterMm, CAD.sewer)}
              {arrow(X(p.a), Y(drainY), X(q.a), Y(drainY), CAD.sewer)}
              <Txt x={(X(p.a) + X(q.a)) / 2} y={Y(drainY) - s(sg.diameterMm) / 2 - 2} size={5} fill={CAD.sewer}>
                {`Ø${pvcSewer(sg.diameterMm)}`}
              </Txt>
              <Txt x={(X(p.a) + X(q.a)) / 2} y={top + H + 11} size={5} fill={CAD.sewer}>
                i=2%
              </Txt>
            </g>
          );
        })}
        {/* saída: curva pra dentro da parede (vista de topo do tubo) */}
        <circle cx={X(exitA)} cy={Y(drainY)} r={Math.max(2, s(exitDia) / 2)} fill={CAD.paper} stroke={CAD.sewer} strokeWidth={0.6} />
        <path
          d={`M${X(exitA) - 1.6} ${Y(drainY) - 1.6} L${X(exitA) + 1.6} ${Y(drainY) + 1.6} M${X(exitA) + 1.6} ${Y(drainY) - 1.6} L${X(exitA) - 1.6} ${Y(drainY) + 1.6}`}
          stroke={CAD.sewer}
          strokeWidth={0.5}
        />
        <Txt x={X(exitA)} y={Y(drainY) - s(exitDia) / 2 - 8} size={4.6} fill={CAD.sewer} weight={700}>
          → CAIXA
        </Txt>
        {h.washers.map((w, i) => {
          const sp = w.standpipe;
          const d = Math.max(STANDPIPE_MIN, sp.diameterMm);
          // junção a 45° na base, entrando no tubo de esgoto
          const dir = X(exitA) < X(sp.a) ? -1 : 1;
          const jy = drainY + 90;
          return (
            <g key={`sp${i}`} data-elevation-standpipe>
              {tubeV(sp.a, jy, sp.topY, d, CAD.sewer)}
              <path d={`M${X(sp.a)} ${Y(jy)} L${X(sp.a) + dir * s(90)} ${Y(drainY)}`} stroke={CAD.sewer} strokeWidth={0.5} />
              {arrow(X(sp.a), Y(sp.topY), X(sp.a), Y(jy), CAD.sewer)}
              <ellipse cx={X(sp.a)} cy={Y(sp.topY)} rx={Math.max(0.8, s(d) / 2)} ry={0.8} stroke={CAD.sewer} strokeWidth={0.5} />
              <Txt x={X(sp.a) - s(d) / 2 - 3} y={Y((jy + sp.topY) / 2)} size={4.6} fill={CAD.sewer} rotate={-90}>
                {`Ø${pvcSewer(d)}`}
              </Txt>
            </g>
          );
        })}
        {h.vents.map((v, i) => (
          <g key={`tv${i}`}>
            {tubeV(v.a, drainY, v.topY, v.diameterMm, CAD.sewer)}
            <Txt x={X(v.a) + 4} y={Math.max(Y(v.topY), top) + 16} size={4.4} fill={CAD.sewer} anchor="start">
              TV ↑ forro
            </Txt>
          </g>
        ))}
        {/* ralinho no piso */}
        <rect
          x={X(h.floorDrain.a) - s(h.floorDrain.sizeMm) / 2}
          y={top + H - 1}
          width={s(h.floorDrain.sizeMm)}
          height={2}
          fill={CAD.sewer}
        />
      </g>

      {/* ÁGUA: barramento no piso → sobe em cada lavadora (registro no meio) → T */}
      <g data-elevation-water>
        {/* bomba pressurizadora e a entrada da concessionária (vem da parede) */}
        <rect x={X(h.pump.a) - s(PUMP_W_MM) / 2} y={Y(PUMP_BASE_MM + PUMP_H_MM)} width={s(PUMP_W_MM)} height={s(PUMP_H_MM)} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.5} rx={1} />
        <Txt x={X(h.pump.a)} y={Y(PUMP_BASE_MM + PUMP_H_MM / 2) + 2} size={4.2}>
          BOMBA
        </Txt>
        <circle cx={X(h.pump.a)} cy={Y(PUMP_BASE_MM + PUMP_H_MM + 120)} r={Math.max(1.6, s(h.waterEntry.diameterMm) / 2)} fill={CAD.paper} stroke={CAD.water} strokeWidth={0.6} />
        {tubeV(h.pump.a, PUMP_BASE_MM + PUMP_H_MM, PUMP_BASE_MM + PUMP_H_MM + 120, h.waterEntry.diameterMm, CAD.water)}
        <Txt x={X(h.pump.a)} y={Y(PUMP_BASE_MM + PUMP_H_MM + 120) - 5} size={4.6} fill={CAD.water} weight={700}>
          AF ← CONCESSIONÁRIA
        </Txt>
        {tubeV(h.pump.a, manY, PUMP_BASE_MM, manDia, CAD.water)}
        {waterStops.slice(1).map((a1, i) => {
          const a0 = waterStops[i];
          const away = a0 >= h.pump.a; // a água sai da bomba pros dois lados
          const [f, t] = away ? [a0, a1] : [a1, a0];
          return (
            <g key={`m${i}`}>
              {tubeH(a0, a1, manY, manDia, CAD.water)}
              {arrow(X(f), Y(manY), X(t), Y(manY), CAD.water)}
              <Txt x={(X(a0) + X(a1)) / 2} y={Y(manY) - s(manDia) / 2 - 2.5} size={5} fill={CAD.water}>
                {`Ø${manDia}`}
              </Txt>
            </g>
          );
        })}
        {h.washers.map((w, i) => {
          const [r0, r1] = w.water.riser;
          const vx = X(w.water.valve.a);
          const vy = Y(w.water.valve.y);
          return (
            <g key={`r${i}`} data-elevation-riser>
              {tubeV(r0.a, r0.y, r1.y, 25, CAD.water)}
              {arrow(X(r0.a), Y(r0.y), X(r0.a), Y(r1.y), CAD.water)}
              {/* registro de gaveta */}
              <path d={`M${vx - 2.4} ${vy - 2.4} L${vx + 2.4} ${vy - 2.4} L${vx - 2.4} ${vy + 2.4} L${vx + 2.4} ${vy + 2.4} Z`} fill={CAD.water} stroke={CAD.water} strokeWidth={0.4} />
              <line x1={vx} y1={vy} x2={vx + 4} y2={vy} stroke={CAD.water} strokeWidth={0.6} />
              {/* T com cotovelo de 90° em cada ponta (virado pra máquina) */}
              {tubeH(w.water.tee[0].a, w.water.tee[1].a, r1.y, 25, CAD.water)}
              {w.water.tee.map((t, k) => (
                <circle key={k} cx={X(t.a)} cy={Y(t.y)} r={Math.max(1.3, s(25) / 2)} fill={CAD.paper} stroke={CAD.water} strokeWidth={0.6} />
              ))}
              <Txt x={X(r0.a) - s(25) / 2 - 3} y={Y((r0.y + w.water.valve.y) / 2)} size={4.4} fill={CAD.water} rotate={-90}>
                Ø25
              </Txt>
            </g>
          );
        })}
      </g>

      </g>

      {/* Cotas: água em cima (entre os pontos), esgoto embaixo (entre os tubos de dreno), alturas à esquerda */}
      {waterStops.slice(1).map((a1, i) => {
        const a0 = waterStops[i];
        const y = Y(Math.max(teeY, standTop)) - CHAIN_GAP;
        return <Dim key={`cw${i}`} x0={X(a0)} y0={y} x1={X(a1)} y1={y} text={formatMeters(Math.abs(a1 - a0))} />;
      })}
      {sewerStops.slice(1).map((a1, i) => {
        const a0 = sewerStops[i];
        const y = top + H + 22;
        return <Dim key={`cs${i}`} x0={X(a0)} y0={y} x1={X(a1)} y1={y} text={formatMeters(Math.abs(a1 - a0))} />;
      })}
      <Dim x0={dimX} y0={Y(0)} x1={dimX} y1={Y(teeY)} text={formatMeters(teeY)} />
      <Dim x0={dimX - 12} y0={Y(0)} x1={dimX - 12} y1={Y(standTop)} text={formatMeters(standTop)} />

      <text x={-wall} y={top + H + 44} fontSize={11} fill={CAD.ink}>
        ÁGUA FRIA E ESGOTO
      </text>
      <text x={-wall} y={top + H + 55} fontSize={8} fill={CAD.ink}>
        VISTA 01
      </text>
    </g>
  );
}

