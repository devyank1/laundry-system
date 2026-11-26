import type { Layout, Rect } from "../engine/types";
import { formatMeters } from "./planTheme";

// Medidas da planta, em mm no sistema da planta: x para a direita, y para
// baixo, fachada (parede da porta) em y = roomDepth.
//  - correntes por fora da loja (fundo, espaço livre, porta);
//  - corrente junto das máquinas (máquinas e vão até a porta técnica);
//  - dentro da loja, só a distância dos móveis até a fachada.
// O tamanho dos móveis vai como texto, sem linha (sizeText).

export type MeasureId = "balcao-fachada" | "cadeiras-fachada" | "maquinas-total" | "mesa-maquinas" | "porta-balcao";

export interface PlanMeasure {
  id: MeasureId;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

/** Corrente de cotas por fora de uma parede: `stops` no eixo dessa parede
 * (x para top/bottom, y para left/right). */
export interface OutsideChain {
  side: "top" | "bottom" | "left" | "right";
  stops: number[];
}

const MIN_MM = 50; // menos que isso não vale uma cota

/** "2,00 × 0,80" (maior × menor). */
export function sizeText(r: Rect): string {
  return `${formatMeters(Math.max(r.width, r.height))} × ${formatMeters(Math.min(r.width, r.height))}`;
}

function uniqSorted(xs: number[]): number[] {
  return Array.from(new Set(xs.map((v) => Math.round(v)))).sort((a, b) => a - b);
}

export function outsideChains(layout: Layout): OutsideChain[] {
  const W = layout.roomWidthMm;
  const H = layout.roomDepthMm;
  const D = layout.drywall.y; // da parede das máquinas até o drywall
  const out: OutsideChain[] = [];
  if (layout.orientation === "back") {
    out.push({ side: "top", stops: [0, W] }); // largura do fundo
    out.push({ side: "left", stops: uniqSorted([0, D, H]) }); // fundo + espaço livre até a fachada
  } else {
    const drywallX = layout.machineWall === "right" ? W - D : D;
    out.push({ side: "top", stops: uniqSorted([0, drywallX, W]) }); // fundo + salão
  }
  const fd = layout.frontDoor;
  if (fd) out.push({ side: "bottom", stops: uniqSorted([0, fd.x, fd.x + fd.width, W]) });
  return out;
}

/** Corrente junto das máquinas, no eixo da fileira: cada máquina e o vão até
 * a porta técnica; na lateral, segue até a fachada (espaço livre). */
export function machineChainStops(layout: Layout): number[] {
  const side = layout.orientation === "side";
  const spans = layout.machines.map((m) => (side ? [m.y, m.y + m.depthMm] : [m.x, m.x + m.widthMm]));
  const td = layout.techDoor;
  const doorStart = side ? td.y : td.x;
  const stops = [...spans.flat(), doorStart, doorStart + td.width];
  if (side && layout.machines.length > 0) stops.push(layout.roomDepthMm);
  return uniqSorted(stops);
}

// Primeiro x em que uma linha vertical de y0 a y1 não cruza obstáculo.
function freeX(candidates: number[], y0: number, y1: number, obstacles: Rect[]): number {
  const pad = 120;
  const hits = (x: number) =>
    obstacles.some((o) => x > o.x - pad && x < o.x + o.width + pad && y1 > o.y - pad && y0 < o.y + o.height + pad);
  return candidates.find((x) => !hits(x)) ?? candidates[0];
}

// Da borda de baixo do móvel até a fachada, num x dentro dele que não cruze
// outro móvel nem o giro da porta (de preferência o centro).
function toFacade(id: MeasureId, r: Rect, facadeY: number, others: Rect[]): PlanMeasure | null {
  const bottom = r.y + r.height;
  if (facadeY - bottom < MIN_MM) return null;
  const xs = [0.5, 0.25, 0.75, 0.1, 0.9].map((k) => r.x + r.width * k);
  const x = freeX(xs, bottom + 1, facadeY, others.filter((o) => o !== r));
  return { id, x0: x, y0: bottom, x1: x, y1: facadeY, text: formatMeters(facadeY - bottom) };
}

const FRONT_GAP_MM = 150; // total das máquinas, logo na frente delas

function seg(id: MeasureId, x0: number, y0: number, x1: number, y1: number): PlanMeasure {
  return { id, x0, y0, x1, y1, text: formatMeters(Math.abs(x1 - x0) + Math.abs(y1 - y0)) };
}

// Meio do trecho em comum entre [a0,a1] e [b0,b1]; sem trecho em comum, o meio de a.
function overlapMid(a0: number, a1: number, b0: number, b1: number): number {
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  return hi > lo ? (lo + hi) / 2 : (a0 + a1) / 2;
}

// Total da fileira (na frente das máquinas) e mesa central até as máquinas.
function machineMeasures(layout: Layout): PlanMeasure[] {
  if (layout.machines.length === 0) return [];
  const out: PlanMeasure[] = [];
  const W = layout.roomWidthMm;
  const D = layout.drywall.y;
  const table = layout.furniture?.table ?? null;
  if (layout.orientation === "back") {
    const start = Math.min(...layout.machines.map((m) => m.x));
    const end = Math.max(...layout.machines.map((m) => m.x + m.widthMm));
    out.push(seg("maquinas-total", start, D + FRONT_GAP_MM, end, D + FRONT_GAP_MM));
    if (table && table.y - D >= MIN_MM) {
      const x = overlapMid(table.x, table.x + table.width, start, end);
      out.push(seg("mesa-maquinas", x, D, x, table.y));
    }
  } else {
    const right = layout.machineWall === "right";
    const drywallX = right ? W - D : D;
    const start = Math.min(...layout.machines.map((m) => m.y));
    const end = Math.max(...layout.machines.map((m) => m.y + m.depthMm));
    const x = right ? drywallX - FRONT_GAP_MM : drywallX + FRONT_GAP_MM;
    out.push(seg("maquinas-total", x, start, x, end));
    if (table) {
      const y = overlapMid(table.y, table.y + table.height, start, end);
      const gap = right ? drywallX - (table.x + table.width) : table.x - drywallX;
      if (gap >= MIN_MM) out.push(right ? seg("mesa-maquinas", table.x + table.width, y, drywallX, y) : seg("mesa-maquinas", drywallX, y, table.x, y));
    }
  }
  return out;
}

// Da porta técnica (no drywall) até o balcão, reto pro salão adentro.
function techDoorToCounter(layout: Layout): PlanMeasure | null {
  const c = layout.furniture?.premium?.counter ?? null;
  if (!c) return null;
  const td = layout.techDoor;
  const D = layout.drywall.y;
  if (layout.orientation === "back") {
    if (c.y - D < MIN_MM) return null;
    const x = overlapMid(td.x, td.x + td.width, c.x, c.x + c.width);
    return seg("porta-balcao", x, D, x, c.y);
  }
  const right = layout.machineWall === "right";
  const drywallX = right ? layout.roomWidthMm - D : D;
  const y = overlapMid(td.y, td.y + td.width, c.y, c.y + c.height);
  if (right) return drywallX - (c.x + c.width) >= MIN_MM ? seg("porta-balcao", c.x + c.width, y, drywallX, y) : null;
  return c.x - drywallX >= MIN_MM ? seg("porta-balcao", drywallX, y, c.x, y) : null;
}

export function planMeasurements(layout: Layout): PlanMeasure[] {
  const H = layout.roomDepthMm;
  const f = layout.furniture;
  const extra = [...machineMeasures(layout), ...[techDoorToCounter(layout)].filter((m): m is PlanMeasure => m !== null)];
  if (!f) return extra;
  const fd = layout.frontDoor;
  const door = fd ? [{ x: fd.x, y: H - fd.width, width: fd.width, height: fd.width }] : [];
  const furnitureRects: Rect[] = [f.table, f.totem, f.ac, f.premium?.counter ?? null, f.premium?.pufs ?? null, ...f.poufs].filter(
    (r): r is Rect => !!r,
  );
  const out: (PlanMeasure | null)[] = [];
  const counter = f.premium?.counter ?? null;
  if (counter) out.push(toFacade("balcao-fachada", counter, H, [...furnitureRects, ...door]));
  if (f.poufs.length > 0) {
    const nearest = f.poufs.reduce((a, b) => (b.y + b.height > a.y + a.height ? b : a));
    out.push(toFacade("cadeiras-fachada", nearest, H, [...furnitureRects.filter((o) => !f.poufs.includes(o)), ...door]));
  }
  return [...extra, ...out.filter((m): m is PlanMeasure => m !== null)];
}
