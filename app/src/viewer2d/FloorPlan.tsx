import { forwardRef, useId, type ReactNode } from "react";
import type { Layout, Rect, WallSide } from "../engine/types";
import { CAD, formatMeters } from "./planTheme";
import { DeviceSymbol, ElectricalOverlay, LuminaireSymbol, RunStroke } from "./ElectricalSheet";

// Planta baixa no padrão das pranchas de projeto (pasta /plantas): fundo
// branco, traço preto fino, alvenaria hachurada, drywall em xadrez, mobiliário
// só em contorno, nome do ambiente + área em cinza, cotas, "VISTA 01" e as
// instalações por cor (água azul, esgoto verde, elétrica amarela).

const SCALE = 0.08; // px por mm
const PAD = 64; // margem em volta do desenho (paredes, cotas)
const MIN_CONTENT_WIDTH = 440;
const LEGEND_COL_WIDTH = 160;
const LEGEND_ROW_HEIGHT = 16;
const LEGEND_COL_WIDTH_WIDE = 250; // textos longos da legenda elétrica

const WALL_MM = 150; // alvenaria
const DRYWALL_MM = 100;
const FACADE_GLASS_MM = 60; // vidro da fachada (linha dupla)
const MARQUISE_MM = 1200; // projeção da marquise além da fachada
const CHAIN_OFFSET_MM = WALL_MM + 450; // cota das máquinas, por fora da parede
const CHAIN_STEP_MM = 350; // distância entre duas correntes de cota
const OVERALL_OFFSET_MM = 700; // cota geral, por fora de tudo

const JUG_W_MM = 190; // galão: base ~19 x 13 cm
const JUG_D_MM = 130;
const DOSING_W_MM = 128; // bomba dosadora: ~13 x 4 cm
const DOSING_D_MM = 44;
const PUMP_HALF_MM = 150; // bomba pressurizadora: ~30 cm de base
const PUMP_C0_MM = 340; // da parede de trás até a frente da base
const PUMP_DEPTH_MM = 290;
const OUTSIDE_ARROW_MM = 250; // bocal de exaustão, do lado de fora da parede
const MACHINE_FRONT_MM = 90; // faixa do painel/porta na frente da máquina

// Bitolas comerciais de PVC (esgoto): a prancha mostra o tubo que se compra.
const PVC_SEWER_MM = [40, 50, 75, 100, 150];
function pvcSewer(dMm: number): number {
  return PVC_SEWER_MM.find((d) => d >= dMm - 2) ?? PVC_SEWER_MM[PVC_SEWER_MM.length - 1];
}

function mm(value: number): number {
  return value * SCALE;
}

type Pt = { x: number; y: number };

// Pranchas separadas, como no projeto real: layout (arquitetura + mobiliário
// + exaustão) e uma por instalação, com o mobiliário apagado ao fundo.
// Elétrica em duas pranchas, como em img/ele1: iluminação e tomadas.
export type PlanSheet = "layout" | "hidraulica" | "iluminacao" | "eletrica";

export const PLAN_SHEETS: { id: PlanSheet; label: string; title: string }[] = [
  { id: "layout", label: "Layout", title: "PLANTA BAIXA: LAYOUT" },
  { id: "hidraulica", label: "Água e esgoto", title: "PLANTA BAIXA: TÉRREO (ÁGUA E ESGOTO)" },
  { id: "iluminacao", label: "Iluminação", title: "PLANTA BAIXA: ELÉTRICA (ILUMINAÇÃO)" },
  { id: "eletrica", label: "Tomadas", title: "PLANTA BAIXA: ELÉTRICA (TOMADAS)" },
];

// Legenda no padrão das pranchas: amostra do traço/hachura + texto.
type LegendSample =
  | "wall"
  | "drywall"
  | "water"
  | "valve"
  | "hose"
  | "sewer"
  | "standpipe"
  | "electrical"
  | "exhaust"
  | "outlet"
  | "drain"
  | "acDrain"
  | "luminaire"
  | "switch"
  | "sign"
  | "led"
  | "socketLow"
  | "socketMid"
  | "socket220"
  | "steck"
  | "pressurizer"
  | "modem"
  | "acUnit"
  | "panel"
  | "profile"
  | "ceilingConduit"
  | "floorConduit"
  | "circuit";
const LEGEND: { label: string; sample: LegendSample }[] = [
  { label: "Alvenaria", sample: "wall" },
  { label: "Drywall", sample: "drywall" },
  { label: "Água fria (AF) → sentido", sample: "water" },
  { label: "Registro de gaveta + T", sample: "valve" },
  { label: "Mangueira até a máquina", sample: "hose" },
  { label: "Esgoto (ESG), i=2%", sample: "sewer" },
  { label: "Tubo de dreno (sobe 70 cm)", sample: "standpipe" },
  { label: "Eletrocalha / perfilado", sample: "electrical" },
  { label: "Exaustão das secadoras", sample: "exhaust" },
  { label: "Tomada 127 V (clientes)", sample: "outlet" },
  { label: "Ralo 10x10", sample: "drain" },
  { label: "Dreno do ar-condicionado (DRE)", sample: "acDrain" },
  // Elétrica: textos da legenda das pranchas (img/ele2)
  { label: "Ponto de iluminação (1a técnica, 1b salão, 1c marquise)", sample: "luminaire" },
  { label: "Interruptor simples em caixa 4x2\"", sample: "switch" },
  { label: "Ponto de força – saída de fio (letreiro)", sample: "sign" },
  { label: "Fita de LED", sample: "led" },
  { label: "Conj. 02 tomadas 127V 10A baixa h=0,40m", sample: "socketLow" },
  { label: "Conj. 02 tomadas 127V 10A média h=1,10m", sample: "socketMid" },
  { label: "Tomada 220V 20A h=1,10m (LAV lavadora / DOS dosadoras)", sample: "socket220" },
  { label: "Tomada industrial Steck 2P+T 220V (secadora)", sample: "steck" },
  { label: "Ponto elétrico não plugável p/ pressurizador", sample: "pressurizer" },
  { label: "Modem abaixo do QD-01 – tomada 127V + ponto de rede", sample: "modem" },
  { label: "Ar-condicionado split – potência indicada", sample: "acUnit" },
  { label: "Quadro de distribuição de embutir (QD-01)", sample: "panel" },
  { label: "Perfilado perfurado no teto 38x38mm", sample: "profile" },
  { label: "Eletroduto no teto", sample: "ceilingConduit" },
  { label: "Eletroduto no piso", sample: "floorConduit" },
  { label: "Circuito", sample: "circuit" },
];

const SHEET_LEGEND: Record<PlanSheet, LegendSample[]> = {
  layout: ["wall", "drywall", "exhaust"],
  hidraulica: ["water", "valve", "hose", "sewer", "standpipe", "drain", "acDrain"],
  iluminacao: ["luminaire", "switch", "sign", "led", "panel", "profile", "ceilingConduit", "circuit"],
  eletrica: ["socketLow", "socketMid", "socket220", "steck", "pressurizer", "modem", "acUnit", "panel", "profile", "ceilingConduit", "floorConduit"],
};

// Texto com "halo" branco, pra ler por cima das linhas (como o mascaramento do CAD).
function Label({
  x,
  y,
  size,
  fill = CAD.ink,
  anchor = "middle",
  weight = 400,
  rotate = 0,
  spacing,
  children,
}: {
  x: number;
  y: number;
  size: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  rotate?: number;
  spacing?: number;
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
      letterSpacing={spacing}
      stroke={CAD.paper}
      strokeWidth={size / 4}
      paintOrder="stroke"
      strokeLinejoin="round"
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >
      {children}
    </text>
  );
}

// Cota: linha com traços a 45° nas pontas e o valor em metros, numa caixinha
// (como as cotas da fileira de máquinas nas pranchas).
function Dimension({ p0, p1, text, boxed = false }: { p0: Pt; p1: Pt; text: string; boxed?: boolean }) {
  const vertical = Math.abs(p0.x - p1.x) < 0.01;
  const tick = 3;
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const size = 6;
  const boxW = text.length * size * 0.6 + 4;
  return (
    <g data-dimension>
      <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={CAD.ink} strokeWidth={0.4} />
      {[p0, p1].map((p, i) => (
        <g key={i}>
          <line x1={p.x - tick} y1={p.y + tick} x2={p.x + tick} y2={p.y - tick} stroke={CAD.ink} strokeWidth={0.7} />
          <line
            x1={vertical ? p.x - 5 : p.x}
            y1={vertical ? p.y : p.y - 5}
            x2={vertical ? p.x + 5 : p.x}
            y2={vertical ? p.y : p.y + 5}
            stroke={CAD.ink}
            strokeWidth={0.4}
          />
        </g>
      ))}
      {len > boxW * 0.6 && (
        <g transform={vertical ? `rotate(-90 ${mid.x} ${mid.y})` : undefined}>
          {boxed && (
            <rect x={mid.x - boxW / 2} y={mid.y - size - 1} width={boxW} height={size + 2} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.4} />
          )}
          <Label x={mid.x} y={boxed ? mid.y - 1.6 : mid.y - 2} size={size}>
            {text}
          </Label>
        </g>
      )}
    </g>
  );
}

// Cadeira (poltrona) vista de cima: encosto do lado da parede, braços e assento.
function Chair({ r, wall }: { r: Rect; wall: WallSide }) {
  const x = mm(r.x);
  const y = mm(r.y);
  const w = mm(r.width);
  const h = mm(r.height);
  const back = Math.min(w, h) * 0.22;
  const arm = Math.min(w, h) * 0.16;
  // Monta no referencial "encosto em cima" e gira pro lado da parede.
  const rot = { top: 0, right: 90, bottom: 180, left: 270 }[wall];
  const turned = rot === 90 || rot === 270;
  const W = turned ? h : w;
  const H = turned ? w : h;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g data-pouf transform={`rotate(${rot} ${cx} ${cy}) translate(${cx - W / 2} ${cy - H / 2})`} fill="none" stroke={CAD.furniture} strokeWidth={0.6}>
      <rect x={0} y={0} width={W} height={back} rx={1.5} />
      <rect x={0} y={back} width={arm} height={H - back} rx={1.5} />
      <rect x={W - arm} y={back} width={arm} height={H - back} rx={1.5} />
      <path d={`M${arm + 1} ${back + 1} H${W - arm - 1} V${H - 4} Q${W / 2} ${H + 1} ${arm + 1} ${H - 4} Z`} />
    </g>
  );
}

function hexagon(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const t = (Math.PI / 3) * k;
    return `${k === 0 ? "M" : "L"}${cx + r * Math.cos(t)},${cy + r * Math.sin(t)}`;
  }).join(" ") + " Z";
}

export const FloorPlan = forwardRef<SVGSVGElement, { layout: Layout; sheet?: PlanSheet }>(function FloorPlan(
  { layout, sheet = "layout" },
  ref
) {
  const legend = LEGEND.filter((item) => SHEET_LEGEND[sheet].includes(item.sample));
  const sheetTitle = PLAN_SHEETS.find((sh) => sh.id === sheet)!.title;
  const uid = useId().replace(/:/g, "");
  const hatchId = `hatch-${uid}`;
  const crossId = `cross-${uid}`;

  const width = mm(layout.roomWidthMm);
  const height = mm(layout.roomDepthMm);
  const wall = mm(WALL_MM);

  const isSide = layout.orientation === "side";
  // Fileira na parede direita da planta: o across conta a partir dela.
  const mirrored = isSide && layout.machineWall === "right";
  const alongLengthMm = isSide ? layout.roomDepthMm : layout.roomWidthMm;
  const acrossLengthMm = isSide ? layout.roomWidthMm : layout.roomDepthMm;

  // Moldura do desenho: paredes + cotas por fora, marquise embaixo.
  const chainOuterMm = CHAIN_OFFSET_MM + (sheet === "hidraulica" ? CHAIN_STEP_MM : 0);
  const marginLeft = PAD + mm(isSide && !mirrored ? chainOuterMm : OVERALL_OFFSET_MM);
  const marginRight = PAD + mm(isSide && mirrored ? chainOuterMm : OVERALL_OFFSET_MM);
  const marginTop = PAD + (isSide ? wall : mm(chainOuterMm));
  const drawingW = marginLeft + width + marginRight;
  const viewWidth = Math.max(drawingW, MIN_CONTENT_WIDTH + PAD);
  const offsetX = marginLeft + (viewWidth - drawingW) / 2;
  const marquiseBottom = height + wall + mm(MARQUISE_MM);
  const overallDimY = marquiseBottom + mm(OVERALL_OFFSET_MM) / 2;
  const barM = mm(1000); // 1 m na escala do desenho (escala gráfica)
  const titleTop = marginTop + overallDimY + 36;
  const isElectric = sheet === "iluminacao" || sheet === "eletrica";
  const legendColW = isElectric ? LEGEND_COL_WIDTH_WIDE : LEGEND_COL_WIDTH;
  const legendCols = Math.max(1, Math.floor((viewWidth - PAD) / legendColW));
  const legendRows = Math.ceil(legend.length / legendCols);
  const legendTop = titleTop + 44;
  // Quadro de circuitos do QD-01: letras na iluminação, números nas tomadas.
  const circuits = isElectric
    ? layout.electricalPlan.circuits.filter((c) => /^\d/.test(c.id) === (sheet === "eletrica"))
    : [];
  const circuitsTop = legendTop + legendRows * LEGEND_ROW_HEIGHT + 22;
  const circuitRows = Math.ceil(circuits.length / legendCols);
  const viewHeight = circuits.length
    ? circuitsTop + 14 + circuitRows * LEGEND_ROW_HEIGHT + 10
    : legendTop + legendRows * LEGEND_ROW_HEIGHT + 18;

  // Converte (along, across) — along = eixo da fileira de máquinas, across =
  // da parede dela até a frente — pra tela. Em "back" along=X e across=Y; em
  // "side" trocam de eixo (espelho do toXY()/orientedRect() do motor).
  function acrossToX(acrossMm: number): number {
    return mirrored ? layout.roomWidthMm - acrossMm : acrossMm;
  }
  function alongAcrossPoint(alongMm: number, acrossMm: number): Pt {
    return isSide
      ? { x: mm(acrossToX(acrossMm)), y: mm(alongMm) }
      : { x: mm(alongMm), y: mm(acrossMm) };
  }
  function alongAcrossRect(alongMm: number, acrossMm: number, alongExtMm: number, acrossExtMm: number) {
    return isSide
      ? {
          x: mm(mirrored ? layout.roomWidthMm - acrossMm - acrossExtMm : acrossMm),
          y: mm(alongMm),
          w: mm(acrossExtMm),
          h: mm(alongExtMm),
        }
      : { x: mm(alongMm), y: mm(acrossMm), w: mm(alongExtMm), h: mm(acrossExtMm) };
  }
  const textRotate = isSide ? -90 : 0;

  const techDepthMm =
    layout.machines.length > 0
      ? layout.drywall.y - Math.max(...layout.machines.map((m) => (isSide ? m.widthMm : m.depthMm)))
      : 0;
  const areaM2 = (layout.roomWidthMm / 1000) * (layout.roomDepthMm / 1000);
  const techAreaLabelCenter = alongAcrossPoint(alongLengthMm / 2, techDepthMm / 2);

  // Porta técnica: dobradiça do lado da parede, abrindo para a área técnica.
  const techDoor = layout.techDoor;
  const doorAlongMm = isSide ? techDoor.y : techDoor.x;
  const doorAcrossMm = isSide ? acrossToX(techDoor.x) : techDoor.y;
  const hingeAtStart = doorAlongMm === 0;
  const hingeAlongMm = hingeAtStart ? doorAlongMm : doorAlongMm + techDoor.width;
  const hinge = alongAcrossPoint(hingeAlongMm, doorAcrossMm);
  const swingEnd = alongAcrossPoint(hingeAlongMm, doorAcrossMm - techDoor.width);
  const closedTip = alongAcrossPoint(doorAlongMm + (hingeAtStart ? techDoor.width : 0), doorAcrossMm);
  const sideSweep = hingeAtStart !== mirrored ? 1 : 0;
  const doorSweepFlag = isSide ? sideSweep : hingeAtStart ? 0 : 1;
  const drywallX = mm(acrossToX(layout.drywall.y));
  const dw = mm(DRYWALL_MM);

  // Fileira de máquinas no eixo along: extensão de cada uma (pra cota).
  const machineSpans = layout.machines
    .map((m) => (isSide ? { a0: m.y, a1: m.y + m.depthMm } : { a0: m.x, a1: m.x + m.widthMm }))
    .sort((p, q) => p.a0 - q.a0);
  const rowStart = machineSpans.length ? machineSpans[0].a0 : 0;
  const rowEnd = machineSpans.length ? machineSpans[machineSpans.length - 1].a1 : 0;
  const uniqSorted = (xs: number[]) => Array.from(new Set(xs.map((v) => Math.round(v)))).sort((p, q) => p - q);
  const hyd = sheet === "hidraulica" ? layout.hydraulics : null;
  // Correntes de cota por fora da parede de trás: máquinas, ou (na planta de
  // água e esgoto) entre os pontos de água e entre os tubos de dreno.
  const chains: { stops: number[]; offsetMm: number }[] = hyd
    ? [
        { stops: uniqSorted([hyd.pump.a, ...hyd.washers.map((w) => w.water.riser[0].a)]), offsetMm: CHAIN_OFFSET_MM },
        {
          stops: uniqSorted([...hyd.washers.map((w) => w.standpipe.a), hyd.sewerExit.inside.a]),
          offsetMm: CHAIN_OFFSET_MM + CHAIN_STEP_MM,
        },
      ]
    : [{ stops: uniqSorted(machineSpans.flatMap((sp) => [sp.a0, sp.a1])), offsetMm: CHAIN_OFFSET_MM }];

  // Centro do salão (entre o drywall e a fachada / parede oposta).
  // Mais pra frente do salão, onde costuma sobrar piso livre.
  const salonCenter = alongAcrossPoint(alongLengthMm / 2, layout.drywall.y + (acrossLengthMm - layout.drywall.y) * 0.6);
  const roomLabelSize = Math.min(24, Math.max(14, width / 16));

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      width="100%"
      role="img"
      aria-label="Planta baixa da lavanderia"
      data-sheet={sheet}
      fontFamily="Arial, Helvetica, sans-serif"
    >
      <defs>
        <pattern id={hatchId} patternUnits="userSpaceOnUse" width={3.2} height={3.2} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={3.2} stroke={CAD.ink} strokeWidth={0.35} />
        </pattern>
        <pattern id={crossId} patternUnits="userSpaceOnUse" width={2.6} height={2.6} patternTransform="rotate(45)">
          <path d="M0 0 V2.6 M0 0 H2.6" stroke={CAD.ink} strokeWidth={0.3} fill="none" />
        </pattern>
      </defs>

      <rect x={0} y={0} width={viewWidth} height={viewHeight} fill={CAD.paper} />

      <g transform={`translate(${offsetX} ${marginTop})`}>
        {/* Marquise: projeção tracejada na frente da fachada */}
        <rect
          x={-wall}
          y={height + wall}
          width={width + wall * 2}
          height={mm(MARQUISE_MM)}
          fill="none"
          stroke={CAD.ink}
          strokeWidth={0.4}
          strokeDasharray="5 3"
        />
        <Label x={width + wall - 4} y={marquiseBottom - 4} size={5} anchor="end" fill={CAD.gray}>
          PROJEÇÃO MARQUISE
        </Label>

        {/* Área técnica (atrás das máquinas) */}
        {techDepthMm > 0 && (
          <Label
            x={techAreaLabelCenter.x}
            y={techAreaLabelCenter.y + 2}
            size={5.5}
            fill={CAD.gray}
            rotate={textRotate}
            spacing={0.5}
          >
            {`ÁREA TÉCNICA MANUTENÇÃO (${formatMeters(techDepthMm)}m)`}
          </Label>
        )}

        {sheet === "layout" && layout.exhaust && (() => {
          // Exaustão das secadoras (manual Évora): ramais a 45° → coletor
          // escalonado → saída pela parede de trás, bocal pra baixo.
          const ex = layout.exhaust;
          const pt = (p: { a: number; c: number }) => alongAcrossPoint(p.a, p.c);
          const line = (pts: { a: number; c: number }[]) =>
            pts.map((p, i) => `${i === 0 ? "M" : "L"}${pt(p).x},${pt(p).y}`).join(" ");
          const wallP = ex.exit.points[1];
          const arrow = alongAcrossPoint(wallP.a, -OUTSIDE_ARROW_MM);
          const wallPt = alongAcrossPoint(wallP.a, 0);
          const labelPoint = alongAcrossPoint(wallP.a, -WALL_MM - 120);
          const duct = (d: string, dia: number, key: string) => (
            <g key={key}>
              <path d={d} strokeWidth={Math.max(2.4, mm(dia))} stroke={CAD.exhaust} opacity={0.25} />
              <path d={d} strokeWidth={0.6} stroke={CAD.exhaust} strokeDasharray="6 2 1 2" />
            </g>
          );
          return (
            <g data-exhaust fill="none" strokeLinejoin="round" strokeLinecap="round">
              {ex.branches.map((b, i) => duct(line(b.points), b.diameterMm, `b${i}`))}
              {ex.collector.map((seg, i) => duct(line(seg.points), seg.diameterMm, `c${i}`))}
              {duct(line([ex.collector[ex.collector.length - 1].points[1], { a: wallP.a, c: 0 }]), ex.outletDiameterMm, "out")}
              {/* Tampa de limpeza na ponta fechada */}
              <path
                d={line([
                  { a: ex.cleaningCap.a, c: ex.cleaningCap.c - ex.collector[0].diameterMm / 2 - 30 },
                  { a: ex.cleaningCap.a, c: ex.cleaningCap.c + ex.collector[0].diameterMm / 2 + 30 },
                ])}
                strokeWidth={1.2}
                stroke={CAD.ink}
              />
              {/* Bocal pra baixo, do lado de fora da parede */}
              <path d={`M${wallPt.x},${wallPt.y} L${arrow.x},${arrow.y}`} stroke={CAD.exhaust} strokeWidth={0.8} strokeDasharray="2 2" />
              <circle cx={arrow.x} cy={arrow.y} r={2} fill={CAD.exhaust} />
              <Label x={labelPoint.x} y={labelPoint.y} size={5.5} fill={CAD.exhaust} weight={700} rotate={textRotate}>
                {`EXAUSTÃO Ø${ex.outletDiameterMm} · ${formatMeters(ex.lengthMm)}m (máx ${formatMeters(ex.maxLengthMm)}m)`}
              </Label>
            </g>
          );
        })()}

        {sheet === "hidraulica" && layout.hydraulics && (() => {
          // Prancha de água e esgoto no padrão da RP072-26-HID: água fria em
          // azul (entrada → bomba → barramento → registro + T → mangueiras até
          // a máquina), esgoto em verde (tubos de dreno → tubo com i=2% →
          // saída pra caixa), setas no sentido do fluxo e Ø em cada trecho.
          const h = layout.hydraulics;
          const P = (p: { a: number; c: number }) => alongAcrossPoint(p.a, p.c);
          const seg = (pts: { a: number; c: number }[]) =>
            `M${P(pts[0]).x},${P(pts[0]).y} ` + pts.slice(1).map((p) => `L${P(p).x},${P(p).y}`).join(" ");
          const pumpR = alongAcrossRect(h.pump.a - PUMP_HALF_MM, PUMP_C0_MM, PUMP_HALF_MM * 2, PUMP_DEPTH_MM);
          const pipe = (pts: { a: number; c: number }[], color: string, dia: number, dashed = false) => (
            <>
              <path d={seg(pts)} stroke={color} strokeWidth={Math.max(1.8, mm(dia))} opacity={0.22} />
              <path d={seg(pts)} stroke={color} strokeWidth={0.7} strokeDasharray={dashed ? "3 2" : undefined} />
            </>
          );
          // Seta cheia no meio do trecho, apontando no sentido do fluxo.
          const arrow = (from: { a: number; c: number }, to: { a: number; c: number }, color: string) => {
            const p0 = P(from);
            const p1 = P(to);
            const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            if (len < 12) return null;
            const ux = (p1.x - p0.x) / len;
            const uy = (p1.y - p0.y) / len;
            const mx = (p0.x + p1.x) / 2;
            const my = (p0.y + p1.y) / 2;
            const s = 2.6;
            return (
              <path
                d={`M${mx + ux * s} ${my + uy * s} L${mx - ux * s - uy * s * 0.7} ${my - uy * s + ux * s * 0.7} L${mx - ux * s + uy * s * 0.7} ${my - uy * s - ux * s * 0.7} Z`}
                fill={color}
                stroke="none"
              />
            );
          };
          const along = (a0: number, a1: number, c: number) => [
            { a: a0, c },
            { a: a1, c },
          ];
          const label = (a: number, c: number, text: string, color: string) => {
            const p = alongAcrossPoint(a, c);
            return (
              <Label x={p.x} y={p.y + 2} size={4.6} fill={color} rotate={textRotate}>
                {text}
              </Label>
            );
          };

          // --- Água: barramento quebrado nos pontos de cada lavadora --------
          const cMan = h.manifold.points[0].c;
          const risers = h.washers.map((w) => w.water.riser[0].a);
          const waterStops = Array.from(new Set([h.pump.a, ...risers])).sort((p, q) => p - q);
          const waterSegs = waterStops.slice(1).map((a1, i) => {
            const a0 = waterStops[i];
            // a água sai da bomba pros dois lados: a seta aponta pra longe dela
            const away = a0 >= h.pump.a;
            return { from: away ? a0 : a1, to: away ? a1 : a0 };
          });
          const entry = { a: h.waterEntry.outside.a, c: -WALL_MM - 250 };
          const pumpTop = PUMP_C0_MM;
          const pumpFront = PUMP_C0_MM + PUMP_DEPTH_MM;

          // --- Esgoto -------------------------------------------------------
          const exit = h.sewerExit;
          // por fora, só um toco (as cotas ficam mais pra fora)
          const outC = -WALL_MM - 250;
          const exitOut = { a: exit.outside.a, c: outC };
          // Chamadas de fora (concessionária / caixa) de lados opostos, sem cruzar.
          const sewerDir = exit.inside.a <= h.pump.a ? -1 : 1;
          const anchorFor = (dir: number) => ((dir < 0) !== isSide ? "end" : "start");
          const callout = (a: number, dir: number, text: string, color: string) => {
            const p = alongAcrossPoint(a + dir * 70, -WALL_MM - 170);
            return (
              <Label x={p.x} y={p.y + 2} size={4.6} fill={color} weight={700} anchor={anchorFor(dir)} rotate={textRotate}>
                {text}
              </Label>
            );
          };
          const fd = h.floorDrain;
          const firstDrain = h.drainLine[0].points[0];

          return (
            <g data-hydraulics fill="none" strokeLinecap="round" strokeLinejoin="round">
              <g data-sewer>
                {/* Tubo de esgoto: trechos com Ø crescente rumo à saída, i=2% */}
                {h.drainLine.map((s, i) => {
                  const [p, q] = s.points;
                  const horizontal = Math.abs(q.a - p.a) > Math.abs(q.c - p.c);
                  return (
                    <g key={`k${i}`}>
                      {pipe(s.points, CAD.sewer, s.diameterMm)}
                      {arrow(p, q, CAD.sewer)}
                      {horizontal &&
                        label((p.a + q.a) / 2, p.c + 120, `Ø${pvcSewer(s.diameterMm)} i=2%`, CAD.sewer)}
                    </g>
                  );
                })}
                {/* Saída pela parede de trás até a caixa de esgoto */}
                {pipe([exit.inside, exitOut], CAD.sewer, exit.diameterMm)}
                {arrow(exit.inside, exitOut, CAD.sewer)}
                {callout(exit.inside.a, sewerDir, `ESG Ø${pvcSewer(exit.diameterMm)} → CAIXA DE ESGOTO`, CAD.sewer)}
                {/* Tubo de dreno de cada lavadora (sobe até 70 cm) + mangueira da máquina */}
                {h.washers.map((w, i) => {
                  const sp = P(w.standpipe);
                  const r = Math.max(1.8, mm(w.standpipe.diameterMm) / 2);
                  return (
                    <g key={`sp${i}`} data-standpipe>
                      <path d={seg([w.hose[0], w.hose[w.hose.length - 1]])} stroke={CAD.sewer} strokeWidth={0.5} strokeDasharray="1.5 1.2" />
                      <circle cx={sp.x} cy={sp.y} r={r} fill={CAD.paper} stroke={CAD.sewer} strokeWidth={0.8} />
                      <circle cx={sp.x} cy={sp.y} r={r * 0.45} fill={CAD.sewer} stroke="none" />
                    </g>
                  );
                })}
                {/* Ralinho: ramal sob o piso até o começo do tubo */}
                {(() => {
                  const r = alongAcrossRect(fd.a - fd.sizeMm / 2, fd.c - fd.sizeMm / 2, fd.sizeMm, fd.sizeMm);
                  return (
                    <g>
                      <path d={seg([{ a: fd.a, c: fd.c + fd.sizeMm / 2 }, firstDrain])} stroke={CAD.sewer} strokeWidth={0.6} strokeDasharray="3 1.5" />
                      <rect data-floor-drain x={r.x} y={r.y} width={r.w} height={r.h} fill={CAD.paper} stroke={CAD.sewer} strokeWidth={0.7} />
                      <path d={`M${r.x} ${r.y} L${r.x + r.w} ${r.y + r.h} M${r.x + r.w} ${r.y} L${r.x} ${r.y + r.h}`} stroke={CAD.sewer} strokeWidth={0.4} />
                    </g>
                  );
                })()}
                {h.vents.map((v, i) => {
                  const p = P(v);
                  return (
                    <g key={`v${i}`}>
                      <circle cx={p.x} cy={p.y} r={2} fill={CAD.paper} stroke={CAD.sewer} strokeWidth={0.7} />
                      <Label x={p.x} y={p.y - 3} size={3.8} fill={CAD.sewer}>
                        TV
                      </Label>
                    </g>
                  );
                })}
              </g>

              <g data-water>
                {/* Entrada da concessionária → bomba pressurizadora */}
                {pipe([entry, { a: h.pump.a, c: pumpTop }], CAD.water, h.waterEntry.diameterMm)}
                {arrow(entry, { a: h.pump.a, c: 0 }, CAD.water)}
                {callout(entry.a, -sewerDir, `AF Ø${h.waterEntry.diameterMm} ← CONCESSIONÁRIA`, CAD.water)}
                <rect x={pumpR.x} y={pumpR.y} width={pumpR.w} height={pumpR.h} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.6} rx={1.2} />
                <text x={pumpR.x + pumpR.w / 2} y={pumpR.y + pumpR.h / 2 + 1.6} textAnchor="middle" fontSize={4.5} fill={CAD.ink} stroke="none">
                  BOMBA
                </text>
                {/* Bomba → barramento no piso */}
                {pipe([{ a: h.pump.a, c: pumpFront }, { a: h.pump.a, c: cMan }], CAD.water, h.manifold.diameterMm)}
                {/* Barramento, com seta e Ø em cada trecho */}
                {waterSegs.map((s, i) => (
                  <g key={`m${i}`}>
                    {pipe(along(s.from, s.to, cMan), CAD.water, h.manifold.diameterMm)}
                    {arrow({ a: s.from, c: cMan }, { a: s.to, c: cMan }, CAD.water)}
                    {label((s.from + s.to) / 2, cMan - 110, `Ø${h.manifold.diameterMm}`, CAD.water)}
                  </g>
                ))}
                {/* Por lavadora: registro + T, e as 2 mangueiras até a máquina */}
                {h.washers.map((w, i) => {
                  const rp = P(w.water.riser[0]);
                  return (
                    <g key={`w${i}`} data-water-point>
                      <path d={seg(w.water.tee)} stroke={CAD.water} strokeWidth={0.9} />
                      {w.water.hoses.map((hose, k) => (
                        <path key={k} d={seg([w.water.tee[k], hose[0], hose[hose.length - 1]])} stroke={CAD.water} strokeWidth={0.5} strokeDasharray="1.5 1.2" />
                      ))}
                      {/* registro de gaveta: círculo com a borboleta */}
                      <circle cx={rp.x} cy={rp.y} r={2.2} fill={CAD.paper} stroke={CAD.water} strokeWidth={0.7} />
                      <path
                        d={`M${rp.x - 1.5} ${rp.y - 1.5} L${rp.x + 1.5} ${rp.y + 1.5} L${rp.x + 1.5} ${rp.y - 1.5} L${rp.x - 1.5} ${rp.y + 1.5} Z`}
                        fill={CAD.water}
                        stroke="none"
                      />
                    </g>
                  );
                })}
                {/* Dosagem: galões e bombas dosadoras (apagados) */}
                {h.washers.flatMap((w, i) =>
                  w.dosing.jugs.map((jug, k) => {
                    const jr = alongAcrossRect(jug.a - JUG_W_MM / 2, jug.c - JUG_D_MM / 2, JUG_W_MM, JUG_D_MM);
                    const pr = alongAcrossRect(w.dosing.pumps[k].a - DOSING_W_MM / 2, w.dosing.pumps[k].c - DOSING_D_MM, DOSING_W_MM, DOSING_D_MM);
                    return (
                      <g key={`ds${i}-${k}`} stroke={CAD.furniture} strokeWidth={0.4} opacity={0.5}>
                        <rect x={jr.x} y={jr.y} width={jr.w} height={jr.h} rx={1} />
                        <rect x={pr.x} y={pr.y} width={pr.w} height={pr.h} rx={0.6} />
                      </g>
                    );
                  })
                )}
              </g>
            </g>
          );
        })()}

        {sheet === "hidraulica" && layout.acDrain && (() => {
          // Dreno do ar-condicionado (img/dreno): do aparelho, em diagonal pelo
          // salão até o corredor técnico e pra fora pela parede de trás.
          const d = layout.acDrain;
          const pts = d.points.map((p) => ({ x: mm(p.x), y: mm(p.y) }));
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
          // rótulo no trecho mais comprido (a diagonal pelo salão)
          let k = 0;
          let best = 0;
          pts.slice(1).forEach((p, i) => {
            const len = Math.hypot(p.x - pts[i].x, p.y - pts[i].y);
            if (len > best) [best, k] = [len, i];
          });
          const a = pts[k];
          const b = pts[k + 1];
          const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          const up = ang > 90 || ang < -90 ? ang + 180 : ang; // texto nunca de cabeça pra baixo
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const start = pts[0];
          const bubble = { x: start.x + (start.x > width / 2 ? -16 : 16), y: start.y - 16 };
          return (
            <g data-ac-drain fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={path} stroke={CAD.acDrain} strokeWidth={Math.max(1.6, mm(d.diameterMm))} opacity={0.22} />
              <path d={path} stroke={CAD.acDrain} strokeWidth={0.7} strokeDasharray="4 1.5" />
              {pts.slice(1).map((p, i) => {
                const q = pts[i];
                const len = Math.hypot(p.x - q.x, p.y - q.y);
                if (len < 12) return null;
                const ux = (p.x - q.x) / len;
                const uy = (p.y - q.y) / len;
                const mx = (p.x + q.x) / 2;
                const my = (p.y + q.y) / 2;
                const t = 2.4;
                return (
                  <path
                    key={i}
                    d={`M${mx + ux * t} ${my + uy * t} L${mx - ux * t - uy * t * 0.7} ${my - uy * t + ux * t * 0.7} L${mx - ux * t + uy * t * 0.7} ${my - uy * t - ux * t * 0.7} Z`}
                    fill={CAD.acDrain}
                    stroke="none"
                  />
                );
              })}
              <g transform={`rotate(${up} ${mid.x} ${mid.y})`}>
                <Label x={mid.x} y={mid.y - 3} size={5} fill={CAD.acDrain}>
                  {`Ø${d.diameterMm} i=${d.slopePct}%`}
                </Label>
              </g>
              {/* chamada "DRE Ø25" no aparelho, como nas pranchas */}
              <line x1={start.x} y1={start.y} x2={bubble.x} y2={bubble.y} stroke={CAD.acDrain} strokeWidth={0.4} />
              <circle cx={bubble.x} cy={bubble.y} r={8} fill={CAD.paper} stroke={CAD.acDrain} strokeWidth={0.6} />
              <line x1={bubble.x - 8} y1={bubble.y} x2={bubble.x + 8} y2={bubble.y} stroke={CAD.acDrain} strokeWidth={0.4} />
              <text x={bubble.x} y={bubble.y - 2} fontSize={4.6} textAnchor="middle" fill={CAD.acDrain}>
                DRE
              </text>
              <text x={bubble.x} y={bubble.y + 5.4} fontSize={4.6} textAnchor="middle" fill={CAD.acDrain}>
                {`Ø${d.diameterMm}`}
              </text>
            </g>
          );
        })()}

        {/* Drywall com a abertura do corredor técnico */}
        {isSide ? (
          <>
            <line data-drywall x1={drywallX} y1={0} x2={drywallX} y2={mm(layout.techCorridor.y)} stroke={`url(#${crossId})`} strokeWidth={dw} />
            <line
              data-drywall
              x1={drywallX}
              y1={mm(layout.techCorridor.y + layout.techCorridor.height)}
              x2={drywallX}
              y2={height}
              stroke={`url(#${crossId})`}
              strokeWidth={dw}
            />
          </>
        ) : (
          <>
            <line data-drywall x1={0} y1={mm(layout.drywall.y)} x2={mm(layout.techCorridor.x)} y2={mm(layout.drywall.y)} stroke={`url(#${crossId})`} strokeWidth={dw} />
            <line
              data-drywall
              x1={mm(layout.techCorridor.x + layout.techCorridor.width)}
              y1={mm(layout.drywall.y)}
              x2={width}
              y2={mm(layout.drywall.y)}
              stroke={`url(#${crossId})`}
              strokeWidth={dw}
            />
          </>
        )}

        {/* Porta técnica: folha aberta + arco de giro */}
        <line x1={hinge.x} y1={hinge.y} x2={swingEnd.x} y2={swingEnd.y} stroke={CAD.ink} strokeWidth={0.9} />
        <path
          data-door="tech"
          d={`M ${closedTip.x} ${closedTip.y} A ${mm(techDoor.width)} ${mm(techDoor.width)} 0 0 ${doorSweepFlag} ${swingEnd.x} ${swingEnd.y}`}
          fill="none"
          stroke={CAD.ink}
          strokeWidth={0.4}
        />
        <Label x={hinge.x + (hingeAtStart ? 3 : -3)} y={hinge.y + 10} anchor={hingeAtStart ? "start" : "end"} size={5.5}>
          {`PORTA TÉC. ${formatMeters(techDoor.width)}m`}
        </Label>

        {/* Máquinas: contorno + faixa do painel na frente */}
        {layout.machines.map((machine, i) => {
          const x = mm(machine.x);
          const y = mm(machine.y);
          const w = mm(machine.widthMm);
          const h = mm(machine.depthMm);
          const f = mm(MACHINE_FRONT_MM);
          const front = isSide
            ? mirrored
              ? `M${x + f} ${y} V${y + h}`
              : `M${x + w - f} ${y} V${y + h}`
            : `M${x} ${y + h - f} H${x + w}`;
          const cx = x + w / 2;
          const cy = y + h / 2;
          return (
            <g key={`${machine.catalogId}-${machine.instanceIndex}`}>
              <rect x={x} y={y} width={w} height={h} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.8} />
              <path d={front} stroke={CAD.ink} strokeWidth={0.5} />
              {machine.baseMm > 0 && (
                <rect x={x - 1.6} y={y - 1.6} width={w + 3.2} height={h + 3.2} fill="none" stroke={CAD.gray} strokeWidth={0.4} strokeDasharray="2 1.5" />
              )}
              <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize={7} fill={CAD.ink}>
                {`T${i + 1}`}
              </text>
            </g>
          );
        })}

        {layout.machines.length > 0 && (() => {
          // Nome da fileira (cinza espaçado) e marcador VISTA 01 olhando pras máquinas.
          const midAlong = (rowStart + rowEnd) / 2;
          const name = alongAcrossPoint(midAlong, layout.drywall.y + 230);
          const tip = alongAcrossPoint(midAlong, layout.drywall.y + 400);
          const l = alongAcrossPoint(midAlong - 220, layout.drywall.y + 540);
          const r = alongAcrossPoint(midAlong + 220, layout.drywall.y + 540);
          const b0 = alongAcrossPoint(midAlong - 220, layout.drywall.y + 600);
          const b1 = alongAcrossPoint(midAlong + 220, layout.drywall.y + 600);
          // texto ao lado do marcador, pra não cair em cima do mobiliário
          const vista = alongAcrossPoint(midAlong + (isSide ? -300 : 300), layout.drywall.y + 540);
          return (
            <g data-vista>
              <Label x={name.x} y={name.y + 2.5} size={7} fill={CAD.gray} spacing={2} rotate={textRotate}>
                MAQ. LAVAR E SECAR
              </Label>
              <path d={`M${l.x} ${l.y} L${tip.x} ${tip.y} L${r.x} ${r.y}`} fill="none" stroke={CAD.ink} strokeWidth={2.2} strokeLinejoin="miter" />
              <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} stroke={CAD.ink} strokeWidth={2.2} />
              <Label x={vista.x} y={vista.y + 3} size={8} anchor="start" rotate={textRotate}>
                VISTA 01
              </Label>
            </g>
          );
        })()}

        {/* Mobiliário só em contorno */}
        {layout.furniture && (() => {
          const fur = layout.furniture;
          const R = (r: Rect) => ({ x: mm(r.x), y: mm(r.y), w: mm(r.width), h: mm(r.height) });
          const totem = R(fur.totem);
          const table = R(fur.table);
          const ac = R(fur.ac);
          const counter = fur.premium?.counter ? R(fur.premium.counter) : null;
          const pufs = fur.premium?.pufs ? R(fur.premium.pufs) : null;
          const acVertical = ac.h > ac.w;
          return (
            <g fill="none" stroke={CAD.furniture} strokeWidth={0.6} opacity={sheet === "layout" ? 1 : 0.4}>
              {/* Nicho do totem de pagamento */}
              <rect x={totem.x} y={totem.y} width={totem.w} height={totem.h} />
              <rect x={totem.x + 1.5} y={totem.y + 1.5} width={totem.w - 3} height={totem.h - 3} />
              <circle cx={totem.x + totem.w / 2} cy={totem.y + totem.h / 2} r={Math.min(totem.w, totem.h) / 4} />
              <Label x={totem.x + totem.w / 2} y={totem.y - 2} size={4.5} fill={CAD.gray}>
                NICHO TOTEM
              </Label>
              {fur.poufs.map((p, i) => (
                <Chair key={i} r={p} wall={fur.chairsWall} />
              ))}
              <rect x={table.x} y={table.y} width={table.w} height={table.h} rx={2} />
              <Label x={table.x + table.w / 2} y={table.y + table.h / 2 + 2} size={5} fill={CAD.gray}>
                MESA CENTRAL
              </Label>
              {counter && fur.premium && (() => {
                // Balcão alto + 3 banquetas do lado oposto à parede dele.
                const vertical = counter.h > counter.w;
                const along = vertical ? counter.h : counter.w;
                const stool = Math.min(14, along / 4.5);
                const side = fur.premium.counterWall;
                const stools = [1, 2, 3].map((k) => {
                  const t = (along * k) / 4 - stool / 2;
                  if (vertical) {
                    const sx = side === "right" ? counter.x - stool - 2 : counter.x + counter.w + 2;
                    return { x: sx, y: counter.y + t };
                  }
                  const sy = side === "bottom" ? counter.y - stool - 2 : counter.y + counter.h + 2;
                  return { x: counter.x + t, y: sy };
                });
                return (
                  <>
                    <rect data-counter x={counter.x} y={counter.y} width={counter.w} height={counter.h} />
                    {stools.map((s, i) => (
                      <rect key={i} x={s.x} y={s.y} width={stool} height={stool} rx={1} />
                    ))}
                    <Label
                      x={counter.x + counter.w / 2}
                      y={counter.y + counter.h / 2 + 2}
                      size={5}
                      fill={CAD.gray}
                      rotate={vertical ? -90 : 0}
                    >
                      BALCÃO
                    </Label>
                  </>
                );
              })()}
              {pufs && (() => {
                // 3 pufs hexagonais encostados (colmeia), no meio do salão.
                const r = Math.min(pufs.w / 4.2, pufs.h / 3.6);
                const cx = pufs.x + pufs.w / 2;
                const cy = pufs.y + pufs.h / 2 + (r * Math.sqrt(3)) / 4;
                const dx = r * 1.5;
                const dy = (r * Math.sqrt(3)) / 2;
                return (
                  <g data-pufs>
                    <path d={hexagon(cx - dx, cy - dy, r)} />
                    <path d={hexagon(cx, cy, r)} />
                    <path d={hexagon(cx + dx, cy - dy, r)} />
                    <Label x={cx} y={pufs.y + pufs.h + 6} size={4.5} fill={CAD.gray}>
                      PUFS
                    </Label>
                  </g>
                );
              })()}
              {/* Ar-condicionado na parede */}
              <rect x={ac.x} y={ac.y} width={ac.w} height={ac.h} />
              <Label
                x={ac.x + ac.w / 2 + (acVertical ? 1.6 : 0)}
                y={ac.y + ac.h / 2 + (acVertical ? 0 : 1.6)}
                size={4.2}
                fill={CAD.ink}
                rotate={acVertical ? -90 : 0}
              >
                AR CONDICIONADO
              </Label>
            </g>
          );
        })()}

        {/* Nome do ambiente + área, em cinza, como nas pranchas */}
        <g data-room-label>
          <text x={salonCenter.x} y={salonCenter.y} textAnchor="middle" fontSize={roomLabelSize} fill={CAD.roomLabel}>
            ATENDIMENTO
          </text>
          <text x={salonCenter.x} y={salonCenter.y + roomLabelSize * 1.05} textAnchor="middle" fontSize={roomLabelSize} fill={CAD.roomLabel}>
            {`${layout.salonAreaM2.toFixed(2).replace(".", ",")} m²`}
          </text>
        </g>

        {/* Alvenaria hachurada: fundo e laterais (até a fachada) */}
        <g stroke={CAD.ink} strokeWidth={0.7} fill={`url(#${hatchId})`}>
          <rect x={-wall} y={-wall} width={width + wall * 2} height={wall} />
          <rect x={-wall} y={0} width={wall} height={height + wall} />
          <rect x={width} y={0} width={wall} height={height + wall} />
        </g>

        {/* Fachada de vidro (linha dupla), com o vão da porta */}
        {(() => {
          const glass = mm(FACADE_GLASS_MM);
          const fd = layout.frontDoor;
          const spans = fd
            ? [
                [0, mm(fd.x)],
                [mm(fd.x + fd.width), width],
              ]
            : [[0, width]];
          return (
            <g fill="none" stroke={CAD.ink} strokeWidth={0.5}>
              {spans
                .filter(([a, b]) => b - a > 0.5)
                .map(([a, b], i) => (
                  <rect key={i} x={a} y={height + wall / 2 - glass / 2} width={b - a} height={glass} />
                ))}
            </g>
          );
        })()}

        {layout.frontDoor &&
          (() => {
            // Sempre na fachada (parede de baixo), nas duas orientações.
            const fd = layout.frontDoor;
            const wallStart = { x: mm(fd.x), y: mm(fd.y) };
            const wallEnd = { x: mm(fd.x + fd.width), y: mm(fd.y) };
            const openEnd = { x: mm(fd.x), y: mm(fd.y - fd.width) };
            const labelCenter = { x: mm(fd.x + fd.width / 2), y: mm(fd.y) };
            return (
              <>
                <line x1={wallStart.x} y1={wallStart.y} x2={openEnd.x} y2={openEnd.y} stroke={CAD.ink} strokeWidth={0.9} />
                <line x1={wallStart.x} y1={wallStart.y} x2={wallEnd.x} y2={wallEnd.y} stroke={CAD.ink} strokeWidth={0.5} />
                <path
                  data-door="front"
                  d={`M ${wallEnd.x} ${wallEnd.y} A ${mm(fd.width)} ${mm(fd.width)} 0 0 1 ${openEnd.x} ${openEnd.y}`}
                  fill="none"
                  stroke={CAD.ink}
                  strokeWidth={0.4}
                />
                <Label x={labelCenter.x} y={labelCenter.y + wall + 8} size={5.5}>
                  {`PORTA ${formatMeters(fd.width)}m`}
                </Label>
              </>
            );
          })()}

        {isElectric && (
          <ElectricalOverlay plan={layout.electricalPlan} mode={sheet === "iluminacao" ? "lighting" : "power"} px={mm} />
        )}

        {/* Cotas: corrente das máquinas por fora da parede delas + gerais */}
        {chains.flatMap((chain, k) =>
          chain.stops.slice(1).map((st, i) => (
            <Dimension
              key={`ch${k}-${i}`}
              p0={alongAcrossPoint(chain.stops[i], -chain.offsetMm)}
              p1={alongAcrossPoint(st, -chain.offsetMm)}
              text={formatMeters(st - chain.stops[i])}
              boxed
            />
          ))
        )}
        <Dimension p0={{ x: 0, y: overallDimY }} p1={{ x: width, y: overallDimY }} text={formatMeters(layout.roomWidthMm)} />
        {(() => {
          // Cota do comprimento do lado oposto à corrente das máquinas.
          const x = isSide && !mirrored ? width + mm(OVERALL_OFFSET_MM) : -mm(OVERALL_OFFSET_MM);
          return <Dimension p0={{ x, y: 0 }} p1={{ x, y: height }} text={formatMeters(layout.roomDepthMm)} />;
        })()}
      </g>

      {/* Título da prancha + escala gráfica */}
      <g>
        <text x={PAD / 2} y={titleTop + 16} fontSize={Math.min(22, (viewWidth - PAD - barM * 2 - 30) / (sheetTitle.length * 0.62))} fill={CAD.roomLabel}>
          {sheetTitle}
        </text>
        <text x={PAD / 2} y={titleTop + 28} fontSize={7} fill={CAD.gray} letterSpacing={0.5}>
          {`FACHADA: ${(layout.roomWidthMm / 1000).toFixed(2)}m | COMPRIMENTO: ${(
            layout.roomDepthMm / 1000
          ).toFixed(2)}m | ÁREA TOTAL: ${areaM2.toFixed(1)}m²`}
        </text>
        {(() => {
          // Escala gráfica 0-1-2 m (o desenho não sai numa escala de papel fixa).
          const x0 = viewWidth - PAD / 2 - barM * 2;
          const y0 = titleTop + 12;
          return (
            <g data-scale-bar>
              {[0, 1].map((k) => (
                <rect key={k} x={x0 + barM * k} y={y0} width={barM} height={3} fill={k === 0 ? CAD.ink : CAD.paper} stroke={CAD.ink} strokeWidth={0.5} />
              ))}
              {[0, 1, 2].map((k) => (
                <text key={k} x={x0 + barM * k} y={y0 + 11} fontSize={6} textAnchor="middle" fill={CAD.ink}>
                  {`${k}m`}
                </text>
              ))}
              <text x={x0 + barM} y={y0 - 4} fontSize={6} textAnchor="middle" fill={CAD.gray}>
                ESCALA GRÁFICA
              </text>
            </g>
          );
        })()}
      </g>

      {/* Legenda */}
      <line x1={PAD / 2} y1={legendTop - 12} x2={viewWidth - PAD / 2} y2={legendTop - 12} stroke={CAD.ink} strokeWidth={0.4} />
      {legend.map((item, i) => {
        const col = i % legendCols;
        const row = Math.floor(i / legendCols);
        const x = PAD / 2 + col * legendColW;
        const y = legendTop + row * LEGEND_ROW_HEIGHT;
        const sample = (() => {
          switch (item.sample) {
            case "wall":
              return <rect x={x} y={y - 7} width={18} height={7} fill={`url(#${hatchId})`} stroke={CAD.ink} strokeWidth={0.5} />;
            case "drywall":
              return <rect x={x} y={y - 6} width={18} height={5} fill={`url(#${crossId})`} stroke={CAD.ink} strokeWidth={0.4} />;
            case "water":
              return <line x1={x} y1={y - 3.5} x2={x + 18} y2={y - 3.5} stroke={CAD.water} strokeWidth={1.4} />;
            case "sewer":
              return <line x1={x} y1={y - 3.5} x2={x + 18} y2={y - 3.5} stroke={CAD.sewer} strokeWidth={1.4} />;
            case "electrical":
              return <line x1={x} y1={y - 3.5} x2={x + 18} y2={y - 3.5} stroke={CAD.electrical} strokeWidth={1.6} strokeDasharray="5 2" />;
            case "exhaust":
              return <line x1={x} y1={y - 3.5} x2={x + 18} y2={y - 3.5} stroke={CAD.exhaust} strokeWidth={2.4} opacity={0.6} />;
            case "valve":
              return (
                <g>
                  <circle cx={x + 9} cy={y - 3.5} r={3} fill={CAD.paper} stroke={CAD.water} strokeWidth={0.7} />
                  <path d={`M${x + 7} ${y - 5.5} L${x + 11} ${y - 1.5} L${x + 11} ${y - 5.5} L${x + 7} ${y - 1.5} Z`} fill={CAD.water} />
                </g>
              );
            case "hose":
              return <line x1={x} y1={y - 3.5} x2={x + 18} y2={y - 3.5} stroke={CAD.water} strokeWidth={0.7} strokeDasharray="1.5 1.2" />;
            case "standpipe":
              return (
                <g>
                  <circle cx={x + 9} cy={y - 3.5} r={3} fill={CAD.paper} stroke={CAD.sewer} strokeWidth={0.8} />
                  <circle cx={x + 9} cy={y - 3.5} r={1.3} fill={CAD.sewer} />
                </g>
              );
            case "acDrain":
              return <line x1={x} y1={y - 3.5} x2={x + 18} y2={y - 3.5} stroke={CAD.acDrain} strokeWidth={1.2} strokeDasharray="4 1.5" />;
            case "outlet":
              return <path d={`M${x + 6} ${y - 7} L${x + 12} ${y - 3.5} L${x + 6} ${y} Z`} fill={CAD.outlet} />;
            case "luminaire":
              return (
                <g transform={`translate(${x + 9} ${y - 3.5}) scale(0.6)`}>
                  <LuminaireSymbol />
                </g>
              );
            case "switch":
            case "sign":
            case "socketLow":
            case "socketMid":
            case "socket220":
            case "steck":
            case "pressurizer":
            case "modem": {
              const kind = ({
                switch: "interruptor",
                sign: "forca",
                socketLow: "tomada127baixa",
                socketMid: "tomada127media",
                socket220: "tomada220",
                steck: "steck",
                pressurizer: "pressurizador",
                modem: "modem",
              } as const)[item.sample];
              return (
                <g transform={`translate(${x + 9} ${y - 11}) scale(0.55)`}>
                  <DeviceSymbol kind={kind} />
                </g>
              );
            }
            case "acUnit":
              return (
                <g transform={`translate(${x + 9} ${y - 6}) scale(0.32)`}>
                  <DeviceSymbol kind="ar" />
                </g>
              );
            case "led":
              return <line x1={x} y1={y - 3.5} x2={x + 18} y2={y - 3.5} stroke={CAD.outlet} strokeWidth={1.6} strokeDasharray="1 1.6" />;
            case "panel":
              return <rect x={x + 2} y={y - 6} width={14} height={5} fill={CAD.panel} stroke={CAD.ink} strokeWidth={0.4} />;
            case "profile":
              return <RunStroke kind="perfilado" d={`M${x} ${y - 3.5} H${x + 18}`} />;
            case "ceilingConduit":
              return <RunStroke kind="teto" d={`M${x} ${y - 3.5} H${x + 18}`} />;
            case "floorConduit":
              return <RunStroke kind="piso" d={`M${x} ${y - 3.5} H${x + 18}`} />;
            case "circuit":
              return (
                <g>
                  <circle cx={x + 9} cy={y - 3.5} r={4.2} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.5} />
                  <text x={x + 9} y={y - 1.5} fontSize={5.4} textAnchor="middle" fill={CAD.ink}>
                    A
                  </text>
                </g>
              );
            case "drain":
              return <rect x={x + 6} y={y - 6.5} width={6} height={6} fill={CAD.paper} stroke={CAD.sewer} strokeWidth={0.7} />;
          }
        })();
        return (
          <g key={item.label}>
            {sample}
            <text x={x + 24} y={y} fontSize={7.5} fill={CAD.ink}>
              {item.label}
            </text>
          </g>
        );
      })}

      {circuits.length > 0 && (
        <g data-circuits>
          <text x={PAD / 2} y={circuitsTop} fontSize={8} fontWeight={700} fill={CAD.ink}>
            QUADRO DE CIRCUITOS – QD-01
          </text>
          {circuits.map((c, i) => {
            const x = PAD / 2 + (i % legendCols) * legendColW;
            const y = circuitsTop + 14 + Math.floor(i / legendCols) * LEGEND_ROW_HEIGHT;
            return (
              <g key={c.id}>
                <circle cx={x + 9} cy={y - 3.5} r={5} fill={CAD.paper} stroke={CAD.ink} strokeWidth={0.5} />
                <text x={x + 9} y={y - 1.3} fontSize={6} textAnchor="middle" fill={CAD.ink}>
                  {c.id}
                </text>
                <text x={x + 24} y={y} fontSize={7.5} fill={CAD.ink}>
                  {`${c.description} · ${c.voltage} V`}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
});
