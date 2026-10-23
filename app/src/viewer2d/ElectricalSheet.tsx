import type { ReactNode } from "react";
import type { ConduitRun, DeviceKind, ElectricalPlan, PlanXY } from "../engine/electricalPlan";
import type { WallSide } from "../engine/types";
import { CAD } from "./planTheme";

// Prancha elétrica no padrão de img/ele1, com os símbolos da legenda de
// img/ele2: "iluminacao" (pontos 1a/1b/1c em perfilado, circuitos por letra)
// e "tomadas" (tomadas, Steck, ar, pressurizador, circuitos por número).

type Px = (mm: number) => number;

// Parede → giro do símbolo (desenhado com a parede em y=0 e o ambiente em +y).
const WALL_ROT: Record<WallSide, number> = { top: 0, bottom: 180, left: -90, right: 90 };
const ROOM_NORMAL: Record<WallSide, PlanXY> = {
  top: { x: 0, y: 1 },
  bottom: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};
const SYMBOL_DEPTH: Record<DeviceKind, number> = {
  interruptor: 10,
  tomada127baixa: 14,
  tomada127media: 14,
  tomada220: 16,
  steck: 16,
  forca: 16,
  pressurizador: 16,
  ar: 9,
  modem: 12,
};

function Halo({ x, y, size, fill, anchor = "middle", weight, children }: {
  x: number;
  y: number;
  size: number;
  fill: string;
  anchor?: "start" | "middle" | "end";
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
      strokeLinejoin="round"
    >
      {children}
    </text>
  );
}

// Símbolo no referencial local: parede em y=0, ambiente pra +y.
export function DeviceSymbol({ kind }: { kind: DeviceKind }) {
  const c = CAD.outlet;
  const tri = "M0 4 L-5 13 L5 13 Z";
  switch (kind) {
    case "interruptor":
      return (
        <g stroke={c} strokeWidth={0.7}>
          <line x1={0} y1={0} x2={0} y2={2.5} />
          <circle cx={0} cy={6} r={3.5} fill={CAD.paper} />
          <circle cx={0} cy={6} r={1.2} fill={c} stroke="none" />
        </g>
      );
    case "tomada127baixa":
      return (
        <g stroke={c} strokeWidth={0.7} strokeLinejoin="round">
          <line x1={0} y1={0} x2={0} y2={4} />
          <path d={tri} fill={CAD.paper} />
        </g>
      );
    case "tomada127media":
      return (
        <g stroke={c} strokeWidth={0.7} strokeLinejoin="round">
          <line x1={0} y1={0} x2={0} y2={4} />
          <path d={tri} fill={CAD.paper} />
          <path d="M0 4 L-5 13 L0 13 Z" fill={c} />
        </g>
      );
    case "tomada220":
      return (
        <g stroke={c} strokeWidth={0.7} strokeLinejoin="round">
          <line x1={0} y1={0} x2={0} y2={4} />
          <path d={tri} fill={c} />
          <line x1={-5} y1={15.5} x2={5} y2={15.5} strokeWidth={1.2} />
        </g>
      );
    case "steck":
      return (
        <g stroke={c} strokeWidth={0.7}>
          <line x1={0} y1={0} x2={0} y2={3} />
          <circle cx={0} cy={9.5} r={6.5} fill={CAD.paper} />
          <path d="M0 6 L-3 11.5 L3 11.5 Z" fill={c} />
          <circle cx={-3.4} cy={7} r={0.9} fill={c} stroke="none" />
          <circle cx={3.4} cy={7} r={0.9} fill={c} stroke="none" />
        </g>
      );
    case "forca":
      return (
        <g stroke={c} strokeWidth={0.7} fill="none">
          <line x1={0} y1={0} x2={0} y2={3} />
          <circle cx={0} cy={9.5} r={6.5} fill={CAD.paper} />
          <path d="M-3 6.5 L0 12.5 L3 6.5" />
          <line x1={-3.5} y1={5.5} x2={3.5} y2={5.5} />
        </g>
      );
    case "pressurizador":
      return (
        <g stroke={CAD.panel} strokeWidth={0.7}>
          <line x1={0} y1={0} x2={0} y2={3} />
          <circle cx={0} cy={9.5} r={6.5} fill={CAD.paper} />
          <rect x={-3} y={6.5} width={6} height={6} fill={CAD.panel} />
        </g>
      );
    case "modem":
      // modem (caixa + antenas) com a tomada 127 V e o ponto de rede (RJ45)
      return (
        <g stroke={c} strokeWidth={0.7}>
          <line x1={0} y1={0} x2={0} y2={3} />
          <rect x={-7} y={3} width={14} height={7} rx={1.5} fill={CAD.paper} />
          <line x1={-4} y1={3} x2={-6} y2={-1} />
          <line x1={4} y1={3} x2={6} y2={-1} />
          <circle cx={-3} cy={6.5} r={0.9} fill={c} stroke="none" />
          <circle cx={0} cy={6.5} r={0.9} fill={c} stroke="none" />
          <rect x={2} y={5} width={3} height={3} fill={c} stroke="none" />
        </g>
      );
    case "ar":
      return (
        <g stroke={CAD.panel} strokeWidth={0.6}>
          <rect x={-28} y={0} width={56} height={8} rx={1.5} fill={CAD.panel} fillOpacity={0.85} />
          {[-20, -12, -4, 4, 12, 20].map((x) => (
            <line key={x} x1={x} y1={2} x2={x} y2={6} stroke={CAD.paper} />
          ))}
        </g>
      );
  }
}

// Luminária (ponto de iluminação): círculo com o traço, como na legenda.
export function LuminaireSymbol() {
  return (
    <g stroke={CAD.outlet} strokeWidth={0.8}>
      <circle cx={0} cy={0} r={5.5} fill={CAD.paper} />
      <line x1={-5.5} y1={0} x2={5.5} y2={0} />
    </g>
  );
}

// Trecho de eletroduto/perfilado: perfilado em faixa amarela dupla, eletroduto
// no teto azul cheio, no piso azul tracejado.
export function RunStroke({ kind, d }: { kind: ConduitRun["kind"]; d: string }) {
  if (kind === "perfilado") {
    return (
      <g fill="none" strokeLinejoin="round" strokeLinecap="square">
        <path d={d} stroke={CAD.ink} strokeWidth={3.4} opacity={0.55} />
        <path d={d} stroke={CAD.electrical} strokeWidth={2.6} />
        <path d={d} stroke={CAD.paper} strokeWidth={0.5} opacity={0.9} />
      </g>
    );
  }
  return (
    <path
      d={d}
      fill="none"
      stroke={CAD.outlet}
      strokeWidth={0.9}
      strokeDasharray={kind === "piso" ? "4 2" : undefined}
      strokeLinejoin="round"
    />
  );
}

export function CircuitTag({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g data-circuit-tag>
      <circle cx={x} cy={y} r={5} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.6} />
      <text x={x} y={y + 2.2} fontSize={6.2} textAnchor="middle" fill={CAD.ink}>
        {text}
      </text>
    </g>
  );
}

// Etiqueta do circuito no meio do trecho mais comprido, ao lado da linha.
function runTag(pts: PlanXY[]): PlanXY | null {
  let best = 0;
  let at: PlanXY | null = null;
  for (let i = 1; i < pts.length; i++) {
    const [q, p] = [pts[i - 1], pts[i]];
    const len = Math.hypot(p.x - q.x, p.y - q.y);
    if (len > best) {
      best = len;
      const ux = (p.x - q.x) / len;
      const uy = (p.y - q.y) / len;
      at = { x: (p.x + q.x) / 2 + uy * 8, y: (p.y + q.y) / 2 - ux * 8 };
    }
  }
  return best >= 26 ? at : null;
}

function pathOf(pts: PlanXY[]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

function Runs({ runs, px }: { runs: ConduitRun[]; px: Px }) {
  // perfilado por baixo, eletrodutos por cima
  const sorted = [...runs].sort((p, q) => Number(p.kind !== "perfilado") - Number(q.kind !== "perfilado"));
  return (
    <>
      {sorted.map((r, i) => {
        const pts = r.points.map((p) => ({ x: px(p.x), y: px(p.y) }));
        return <RunStroke key={i} kind={r.kind} d={pathOf(pts)} />;
      })}
    </>
  );
}

function Tags({ runs, px }: { runs: ConduitRun[]; px: Px }) {
  return (
    <>
      {runs.map((r, i) => {
        if (!r.circuit) return null;
        const at = runTag(r.points.map((p) => ({ x: px(p.x), y: px(p.y) })));
        return at ? <CircuitTag key={i} x={at.x} y={at.y} text={r.circuit} /> : null;
      })}
    </>
  );
}

function Devices({ plan, px, which }: { plan: ElectricalPlan; px: Px; which: "lighting" | "power" }) {
  const list = which === "lighting" ? plan.lighting.devices : plan.power.devices;
  return (
    <>
      {list.map((d, i) => {
        const x = px(d.x);
        const y = px(d.y);
        const n = d.wall ? ROOM_NORMAL[d.wall] : { x: 0, y: 1 };
        const depth = SYMBOL_DEPTH[d.kind] + 6;
        const tx = x + n.x * depth;
        const ty = y + n.y * depth + (n.y >= 0 ? 4 : 0);
        const showCircuit = which === "power";
        return (
          <g
            key={i}
            data-device={d.kind}
            {...(d.kind === "tomada127baixa" ? { "data-outlet-127": "" } : {})}
          >
            {d.wall ? (
              <g transform={`translate(${x} ${y}) rotate(${WALL_ROT[d.wall]})`}>
                <DeviceSymbol kind={d.kind} />
              </g>
            ) : (
              <g transform={`translate(${x} ${y - 8})`}>
                <rect x={-8} y={0} width={16} height={18} fill={CAD.paper} stroke={CAD.outlet} strokeWidth={0.5} />
                <DeviceSymbol kind={d.kind} />
              </g>
            )}
            {d.kind === "ar" ? (
              <>
                <Halo x={tx} y={ty} size={6.5} fill={CAD.ink}>
                  {d.label}
                </Halo>
                <Halo x={tx} y={ty + 8} size={7} fill={CAD.panel} weight={700}>
                  {d.circuit}
                </Halo>
              </>
            ) : (
              <>
                {showCircuit && (
                  <Halo x={tx} y={ty} size={7} fill={CAD.outlet} weight={700}>
                    {d.circuit}
                  </Halo>
                )}
                {d.label && (
                  <Halo x={tx} y={ty + (showCircuit ? 7 : 0)} size={5} fill={CAD.ink}>
                    {d.label}
                  </Halo>
                )}
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

function Panel({ plan, px }: { plan: ElectricalPlan; px: Px }) {
  const p = plan.panel;
  const n = ROOM_NORMAL[p.wall];
  const cx = px(p.x + p.width / 2);
  const cy = px(p.y + p.height / 2);
  const along = n.x === 0;
  // o modem fica na frente do quadro: no drywall o rótulo vai pro salão; na
  // lateral, acima do quadro
  const k = p.face === "drywall" ? -1 : 1;
  return (
    <g data-panel>
      <rect x={px(p.x)} y={px(p.y)} width={px(p.width)} height={px(p.height)} fill={CAD.panel} stroke={CAD.ink} strokeWidth={0.5} />
      {along ? (
        <line x1={px(p.x)} y1={cy} x2={px(p.x + p.width)} y2={cy} stroke={CAD.paper} strokeWidth={0.5} />
      ) : (
        <line x1={cx} y1={px(p.y)} x2={cx} y2={px(p.y + p.height)} stroke={CAD.paper} strokeWidth={0.5} />
      )}
      <Halo
        x={cx + (along ? 0 : n.x * 16)}
        y={along ? cy + n.y * k * 13 + 2 : px(p.y) - 5}
        size={7}
        fill={CAD.panel}
        weight={700}
      >
        {p.label}
      </Halo>
    </g>
  );
}

export function ElectricalOverlay({ plan, mode, px }: { plan: ElectricalPlan; mode: "lighting" | "power"; px: Px }) {
  if (mode === "lighting") {
    const L = plan.lighting;
    return (
      <g data-lighting>
        <Runs runs={L.runs} px={px} />
        {L.ledStrip && (
          <g data-led-strip>
            <path d={pathOf(L.ledStrip.points.map((p) => ({ x: px(p.x), y: px(p.y) })))} stroke={CAD.outlet} strokeWidth={1.6} strokeDasharray="1 1.6" fill="none" />
            <Halo x={px(L.ledStrip.points[0].x)} y={px(L.ledStrip.points[0].y) - 5} size={5.5} fill={CAD.ink} anchor="start">
              FITA DE LED
            </Halo>
          </g>
        )}
        {L.junctions.map((j, i) => (
          <rect key={`j${i}`} x={px(j.x) - 2.4} y={px(j.y) - 2.4} width={4.8} height={4.8} fill={CAD.electrical} stroke={CAD.ink} strokeWidth={0.5} />
        ))}
        {L.luminaires.map((l, i) => (
          <g key={`l${i}`} data-luminaire={l.kind} transform={`translate(${px(l.x)} ${px(l.y)})`}>
            <LuminaireSymbol />
            <Halo x={0} y={-8} size={6} fill={CAD.ink}>
              {l.kind}
            </Halo>
          </g>
        ))}
        <Devices plan={plan} px={px} which="lighting" />
        <Tags runs={L.runs} px={px} />
        <Panel plan={plan} px={px} />
      </g>
    );
  }
  const P = plan.power;
  return (
    <g data-electrical>
      <Runs runs={P.runs} px={px} />
      <Devices plan={plan} px={px} which="power" />
      <Tags runs={P.runs.filter((r) => r.kind !== "perfilado")} px={px} />
      <Panel plan={plan} px={px} />
    </g>
  );
}
