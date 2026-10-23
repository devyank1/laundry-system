import type { FurnitureLayout, LayoutOrientation, Rect, TechAccessSide, WallSide } from "./types";

// Dreno do ar-condicionado (DRE Ø25, i=2%), como nas pranchas (img/dreno):
// sai da ponta do aparelho, afasta da parede, corta o salão em diagonal até
// o corredor técnico, passa por ele e sai pela parede de trás.

export const AC_DRAIN_DIAMETER_MM = 25;
export const AC_DRAIN_SLOPE_PCT = 2;
const OFF_WALL_MM = 300; // primeiro trecho: sai perpendicular à parede do AC
const BEFORE_DRYWALL_MM = 400; // chega no corredor um pouco antes do drywall
const OUTSIDE_MM = 400; // passa pra fora da parede de trás

export interface PlanPoint {
  x: number;
  y: number;
}

export interface AcDrainLayout {
  // Trajeto em coordenadas da planta (mm); o último ponto já está do lado de
  // fora da parede de trás.
  points: PlanPoint[];
  diameterMm: number;
  slopePct: number;
  lengthMm: number; // só o trecho dentro da loja
  dropMm: number; // desnível total com i=2%
}

export interface AcDrainInput {
  furniture: FurnitureLayout | null;
  techCorridor: Rect;
  drywallAcrossMm: number;
  orientation: LayoutOrientation;
  machineWall: TechAccessSide;
  roomWidthMm: number;
}

const OFF_WALL_DIR: Record<WallSide, PlanPoint> = {
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  top: { x: 0, y: 1 },
  bottom: { x: 0, y: -1 },
};

export function computeAcDrain(input: AcDrainInput): AcDrainLayout | null {
  const { furniture, techCorridor, drywallAcrossMm, orientation, machineWall, roomWidthMm } = input;
  if (!furniture) return null;

  // (along, across) → planta: em "back" along=x e across=y; em "side" o
  // across conta a partir da parede das máquinas.
  const side = orientation === "side";
  const toPlan = (a: number, c: number): PlanPoint =>
    side ? { x: machineWall === "left" ? c : roomWidthMm - c, y: a } : { x: a, y: c };
  const corridorAlong = side
    ? techCorridor.y + techCorridor.height / 2
    : techCorridor.x + techCorridor.width / 2;

  const front = toPlan(corridorAlong, drywallAcrossMm + BEFORE_DRYWALL_MM);
  const atDrywall = toPlan(corridorAlong, drywallAcrossMm);
  const atWall = toPlan(corridorAlong, 0);
  const outside = toPlan(corridorAlong, -OUTSIDE_MM);

  // Saída do dreno: ponta do aparelho mais perto do corredor, na face da parede.
  const ac = furniture.ac;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const start = {
    x: clamp(front.x, ac.x, ac.x + ac.width),
    y: clamp(front.y, ac.y, ac.y + ac.height),
  };
  const dir = OFF_WALL_DIR[furniture.acWall];
  const offWall = { x: start.x + dir.x * OFF_WALL_MM, y: start.y + dir.y * OFF_WALL_MM };

  const inside = [start, offWall, front, atDrywall, atWall];
  const lengthMm = inside.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - inside[i].x, p.y - inside[i].y), 0);
  return {
    points: [...inside, outside],
    diameterMm: AC_DRAIN_DIAMETER_MM,
    slopePct: AC_DRAIN_SLOPE_PCT,
    lengthMm: Math.round(lengthMm),
    dropMm: Math.round((lengthMm * AC_DRAIN_SLOPE_PCT) / 100),
  };
}
