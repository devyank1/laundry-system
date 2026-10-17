import type { Layout } from "../engine/types";
import { facadeDims } from "./facade";
import { DRYWALL_THICKNESS_MM } from "../engine/constants";
import { drywallFrame } from "./placement";

// Tapetes, dispensers e lixeira fixos de qualquer loja (não dependem do modo
// inauguração). Metros
// no mundo 3D; `yaw` vira a frente do item pro salão.

const M = (mmValue: number) => mmValue / 1000;

export const ENTRANCE_RUG = { width: 1.2, depth: 0.8 };
export const MACHINE_RUG_DEPTH = 0.8;
const MACHINE_RUG_GAP = 0.05; // do drywall até a borda do tapete
const ENTRANCE_RUG_GAP = 0.1; // do vidro da porta até a borda do tapete
export const DISPENSER_MOUNT_HEIGHT = 1.35;
const DISPENSER_MIN_SPAN = 0.42; // largura mínima do trecho de drywall livre (m)
const DISPENSER_EDGE_GAP = 0.02;
const TRASH_GAP = 0.2; // da parede (drywall) até o centro da lixeira

export interface RugPlacement {
  x: number;
  z: number;
  yaw: number;
  width: number; // ao longo da parede/da porta
  depth: number; // entrando no salão
}

export interface StoreFixtures {
  // Tapete logo depois da porta de entrada, centrado nela.
  entranceRug: RugPlacement;
  // Tapete em frente às máquinas, da primeira à última (largura = fileira).
  machineRug: RugPlacement | null;
  // Dispensers (papel toalha + álcool gel) no drywall, ao lado das máquinas,
  // no lado oposto ao totem; null se não sobra trecho livre.
  dispensers: { x: number; z: number; yaw: number } | null;
  // Lixeira no chão, embaixo dos dispensers.
  trash: { x: number; z: number } | null;
}

export function placeStoreFixtures(layout: Layout): StoreFixtures {
  const f = facadeDims(layout);
  const entranceRug: RugPlacement = {
    x: (f.door.x0 + f.door.x1) / 2,
    z: f.glassZ - ENTRANCE_RUG_GAP - ENTRANCE_RUG.depth / 2,
    yaw: 0,
    ...ENTRANCE_RUG,
  };

  const frame = drywallFrame(layout);
  const spans = layout.drywall.openings.map(frame.markerSpan);
  let machineRug: RugPlacement | null = null;
  if (spans.length > 0) {
    const start = Math.min(...spans.map((s) => s.start));
    const end = Math.max(...spans.map((s) => s.end));
    const across = M(layout.drywall.y + DRYWALL_THICKNESS_MM) + MACHINE_RUG_GAP + MACHINE_RUG_DEPTH / 2;
    const [x, , z] = frame.pos((start + end) / 2, 0, across);
    machineRug = { x, z, yaw: frame.yaw, width: end - start, depth: MACHINE_RUG_DEPTH };
  }

  const spot = dispenserSpot(layout);
  const trash = spot
    ? {
        x: spot.x + Math.sin(spot.yaw) * TRASH_GAP,
        z: spot.z + Math.cos(spot.yaw) * TRASH_GAP,
      }
    : null;

  return { entranceRug, machineRug, dispensers: spot, trash };
}

// Dispensers no drywall, num trecho livre do lado da fileira de máquinas
// oposto ao totem (totem à direita → dispensers à esquerda, e vice-versa).
// Sem totem, usa o lado oposto ao corredor técnico.
export function dispenserSpot(layout: Layout): StoreFixtures["dispensers"] {
  const frame = drywallFrame(layout);
  const spans = layout.drywall.openings.map(frame.markerSpan);
  if (spans.length === 0) return null;
  const rowMid = (Math.min(...spans.map((s) => s.start)) + Math.max(...spans.map((s) => s.end))) / 2;

  const corridor = frame.spatialSpan(layout.techCorridor);
  const reference = layout.furniture ? frame.spatialSpan(layout.furniture.totem) : corridor;
  const referenceIsLow = (reference.start + reference.end) / 2 < rowMid;

  const busy = [...spans, corridor, ...(layout.furniture ? [frame.spatialSpan(layout.furniture.totem)] : [])].sort(
    (a, b) => a.start - b.start
  );
  const free: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const b of [...busy, { start: frame.alongLength, end: frame.alongLength }]) {
    if (b.start - cursor >= DISPENSER_MIN_SPAN + DISPENSER_EDGE_GAP * 2) {
      free.push({ from: cursor + DISPENSER_EDGE_GAP, to: b.start - DISPENSER_EDGE_GAP });
    }
    cursor = Math.max(cursor, b.end);
  }

  // Lado oposto ao totem; o trecho mais largo, mais perto da fileira, ganha.
  const candidates = free.filter((seg) => ((seg.from + seg.to) / 2 < rowMid) !== referenceIsLow);
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) =>
    Math.abs((a.from + a.to) / 2 - rowMid) <= Math.abs((b.from + b.to) / 2 - rowMid) ? a : b
  );

  const across = M(layout.drywall.y + DRYWALL_THICKNESS_MM);
  const [x, , z] = frame.pos((best.from + best.to) / 2, 0, across);
  return { x, z, yaw: frame.yaw };
}
