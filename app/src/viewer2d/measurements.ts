import type { Layout, Rect } from "../engine/types";
import { formatMeters } from "./planTheme";

// Medidas extras da planta ("Mostrar medidas"), em mm no sistema da planta:
// x para a direita, y para baixo, fachada (parede da porta) em y = roomDepth.
export type MeasureId =
  | "fundo-largura"
  | "fundo-comprimento"
  | "livre-fachada"
  | "porta-esquerda"
  | "porta-direita"
  | "mesa"
  | "balcao"
  | "balcao-fachada"
  | "cadeiras-fachada";

export interface PlanMeasure {
  id: MeasureId;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

const MIN_MM = 50; // menos que isso não vale uma cota
const INSET_MM = 200; // cotas do fundo, para dentro da faixa
const FACADE_INSET_MM = 250; // cotas junto da fachada
const FURNITURE_GAP_MM = 150; // cota do tamanho do móvel, por fora dele

function horizontal(id: MeasureId, x0: number, x1: number, y: number, text = formatMeters(x1 - x0)): PlanMeasure {
  return { id, x0, y0: y, x1, y1: y, text };
}
function vertical(id: MeasureId, x: number, y0: number, y1: number, text = formatMeters(y1 - y0)): PlanMeasure {
  return { id, x0: x, y0, x1: x, y1, text };
}

// Cota no lado maior do móvel, por fora dele, com "maior × menor".
function sizeOf(id: MeasureId, r: Rect): PlanMeasure {
  const text = `${formatMeters(Math.max(r.width, r.height))} × ${formatMeters(Math.min(r.width, r.height))}`;
  return r.width >= r.height
    ? horizontal(id, r.x, r.x + r.width, r.y - FURNITURE_GAP_MM, text)
    : vertical(id, r.x - FURNITURE_GAP_MM, r.y, r.y + r.height, text);
}

// Balcão encosta numa parede: a cota do tamanho vai por dentro, junto dela
// (do lado de fora ficam as banquetas).
function counterSize(r: Rect, wall: string): PlanMeasure {
  const text = `${formatMeters(Math.max(r.width, r.height))} × ${formatMeters(Math.min(r.width, r.height))}`;
  if (r.width >= r.height) {
    const y = wall === "bottom" ? r.y + r.height - FURNITURE_GAP_MM : r.y + FURNITURE_GAP_MM;
    return horizontal("balcao", r.x, r.x + r.width, y, text);
  }
  const x = wall === "right" ? r.x + r.width - FURNITURE_GAP_MM : r.x + FURNITURE_GAP_MM;
  return vertical("balcao", x, r.y, r.y + r.height, text);
}

// Primeiro x (na ordem dada) em que uma linha vertical de y0 a y1 não cruza
// nenhum obstáculo (com folga); sem nenhum livre, o primeiro.
function freeX(candidates: number[], y0: number, y1: number, obstacles: Rect[]): number {
  const pad = 120;
  const hits = (x: number) =>
    obstacles.some((o) => x > o.x - pad && x < o.x + o.width + pad && y1 > o.y - pad && y0 < o.y + o.height + pad);
  return candidates.find((x) => !hits(x)) ?? candidates[0];
}

// Candidatos de x, alternando das paredes pro meio (direita primeiro).
function steps(from: number, to: number): number[] {
  const xs: number[] = [];
  for (let k = 0; k < 12; k++) {
    const a = from + k * 300;
    const b = to - k * 300;
    if (b - a < 0) break;
    xs.push(b, a);
  }
  return xs;
}

// Da borda de baixo do móvel até a fachada, num x dentro dele que não cruze
// outro móvel (de preferência o centro).
function toFacade(id: MeasureId, r: Rect, facadeY: number, others: Rect[]): PlanMeasure | null {
  const bottom = r.y + r.height;
  if (facadeY - bottom < MIN_MM) return null;
  const xs = [0.5, 0.25, 0.75, 0.1, 0.9].map((k) => r.x + r.width * k);
  return vertical(id, freeX(xs, bottom + 1, facadeY, others.filter((o) => o !== r)), bottom, facadeY);
}

export function planMeasurements(layout: Layout): PlanMeasure[] {
  const W = layout.roomWidthMm;
  const H = layout.roomDepthMm;
  const D = layout.drywall.y; // da parede das máquinas até o drywall
  const out: (PlanMeasure | null)[] = [];
  const f = layout.furniture;
  const furnitureRects: Rect[] = f
    ? [f.table, f.totem, f.ac, f.premium?.counter ?? null, f.premium?.pufs ?? null, ...f.poufs].filter((r): r is Rect => !!r)
    : [];
  const fixed: Rect[] = [
    layout.techDoor,
    ...layout.machines.map((m) => ({ x: m.x, y: m.y, width: m.widthMm, height: m.depthMm })),
  ];

  if (layout.orientation === "back") {
    // Fundo: faixa de cima (parede do fundo até o drywall).
    out.push(horizontal("fundo-largura", 0, W, INSET_MM));
    out.push(vertical("fundo-comprimento", freeX(steps(INSET_MM, W - INSET_MM), 0, D, [...fixed, ...furnitureRects]), 0, D));
    const fd0 = layout.frontDoor; // vão + giro da folha
    const door = fd0 ? [{ x: fd0.x, y: H - fd0.width, width: fd0.width, height: fd0.width }] : [];
    out.push(
      H - D >= MIN_MM
        ? vertical("livre-fachada", freeX(steps(FACADE_INSET_MM, W - FACADE_INSET_MM), D, H, [...furnitureRects, ...door]), D, H)
        : null,
    );
  } else {
    // Fundo: faixa lateral, da parede das máquinas até o drywall.
    const right = layout.machineWall === "right";
    const x0 = right ? W - D : 0;
    const x1 = right ? W : D;
    out.push(horizontal("fundo-largura", x0, x1, INSET_MM));
    out.push(vertical("fundo-comprimento", right ? x0 + INSET_MM : x1 - INSET_MM, 0, H));
    if (layout.machines.length > 0) {
      const rowEnd = Math.max(...layout.machines.map((m) => m.y + m.depthMm));
      const x = right ? W - D - FACADE_INSET_MM : D + FACADE_INSET_MM;
      out.push(H - rowEnd >= MIN_MM ? vertical("livre-fachada", x, rowEnd, H) : null);
    }
  }

  const fd = layout.frontDoor;
  if (fd) {
    const y = H - FACADE_INSET_MM;
    out.push(fd.x >= MIN_MM ? horizontal("porta-esquerda", 0, fd.x, y) : null);
    out.push(W - (fd.x + fd.width) >= MIN_MM ? horizontal("porta-direita", fd.x + fd.width, W, y) : null);
  }

  if (f) {
    if (f.table) out.push(sizeOf("mesa", f.table));
    const counter = f.premium?.counter ?? null;
    if (counter) {
      out.push(counterSize(counter, f.premium!.counterWall));
      out.push(toFacade("balcao-fachada", counter, H, furnitureRects));
    }
    if (f.poufs.length > 0) {
      const nearest = f.poufs.reduce((a, b) => (b.y + b.height > a.y + a.height ? b : a));
      out.push(toFacade("cadeiras-fachada", nearest, H, furnitureRects.filter((o) => !f.poufs.includes(o))));
    }
  }
  return out.filter((m): m is PlanMeasure => m !== null);
}
