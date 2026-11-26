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

function toFacade(id: MeasureId, r: Rect, facadeY: number): PlanMeasure | null {
  const bottom = r.y + r.height;
  return facadeY - bottom < MIN_MM ? null : vertical(id, r.x + r.width / 2, bottom, facadeY);
}

export function planMeasurements(layout: Layout): PlanMeasure[] {
  const W = layout.roomWidthMm;
  const H = layout.roomDepthMm;
  const D = layout.drywall.y; // da parede das máquinas até o drywall
  const out: (PlanMeasure | null)[] = [];

  if (layout.orientation === "back") {
    // Fundo: faixa de cima (parede do fundo até o drywall).
    out.push(horizontal("fundo-largura", 0, W, INSET_MM));
    out.push(vertical("fundo-comprimento", W - INSET_MM, 0, D));
    out.push(H - D >= MIN_MM ? vertical("livre-fachada", W - FACADE_INSET_MM, D, H) : null);
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

  const f = layout.furniture;
  if (f) {
    if (f.table) out.push(sizeOf("mesa", f.table));
    const counter = f.premium?.counter ?? null;
    if (counter) {
      out.push(sizeOf("balcao", counter));
      out.push(toFacade("balcao-fachada", counter, H));
    }
    if (f.poufs.length > 0) {
      const nearest = f.poufs.reduce((a, b) => (b.y + b.height > a.y + a.height ? b : a));
      out.push(toFacade("cadeiras-fachada", nearest, H));
    }
  }
  return out.filter((m): m is PlanMeasure => m !== null);
}
