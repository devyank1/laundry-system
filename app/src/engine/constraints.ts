import {
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  TECH_AREA_DEFAULT_MM,
  DRYWALL_THICKNESS_MM,
  SALON_MIN_DEPTH_MM,
  SALON_TRAFFIC_ONLY_DEPTH_MM,
  PREMIUM_MIN_AREA_MM2,
  CEILING_CLEARANCE_MM,
  FURNITURE_BLOCK_WIDTH_MM,
  TECH_DOOR_WIDTH_MM,
  TOTEM_WALL_MM,
  machineBaseMm,
} from "./constants";
import type { CatalogMachine, FurnitureItem, MachineSelection, ProjectState, Violation } from "./types";

export function resolveSelection(
  selections: MachineSelection[],
  catalog: CatalogMachine[]
): { machine: CatalogMachine; qty: number }[] {
  return selections
    .map((s) => ({ machine: catalog.find((m) => m.id === s.catalogId), qty: s.qty }))
    .filter(
      (r): r is { machine: CatalogMachine; qty: number } => !!r.machine && r.qty > 0
    );
}

export function flattenSelection(
  resolved: { machine: CatalogMachine; qty: number }[]
): CatalogMachine[] {
  const list: CatalogMachine[] = [];
  for (const r of resolved) {
    for (let i = 0; i < r.qty; i++) list.push(r.machine);
  }
  return list;
}

export function machineRowWidthMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  const widths = list.reduce((sum, m) => sum + m.widthMm, 0);
  return widths + (list.length - 1) * MACHINE_GAP_MM;
}

// Recuo de segurança da fileira: o maior pedido entre as máquinas dela
// (Mamute não pede; as outras, 50cm).
export function rowClearanceMm(list: CatalogMachine[]): number {
  return list.length ? Math.max(...list.map((m) => m.lateralClearanceMm ?? LATERAL_CLEARANCE_MM)) : LATERAL_CLEARANCE_MM;
}

export function isFurnitureOn(state: ProjectState, item: FurnitureItem): boolean {
  return state.furnitureEnabled && !(state.furnitureOff ?? []).includes(item);
}

// Faixa na ponta livre da fileira (lado oposto à porta técnica): recuo de
// segurança das máquinas ou o nicho de 50cm do totem, quando ele fica ali.
export function freeEndStripMm(state: ProjectState, list: CatalogMachine[]): number {
  const totemThere = isFurnitureOn(state, "totem") && state.totemSide !== state.techAccessSide;
  return Math.max(rowClearanceMm(list), totemThere ? TOTEM_WALL_MM : 0);
}

export function computeMinWidthMm(list: CatalogMachine[], freeEndMm = rowClearanceMm(list)): number {
  // Faixa da ponta livre + fileira + porta técnica de 70cm (já cobre, com
  // folga, os 50cm desse outro lado).
  return freeEndMm + machineRowWidthMm(list) + TECH_DOOR_WIDTH_MM;
}

// Móvel no chão do salão? (totem e ar ficam na parede: não contam)
export function hasFloorFurniture(state: ProjectState): boolean {
  const premium = state.roomWidthMm * state.roomDepthMm >= PREMIUM_MIN_AREA_MM2;
  return (
    isFurnitureOn(state, "table") ||
    isFurnitureOn(state, "chairs") ||
    (premium && (isFurnitureOn(state, "counter") || isFurnitureOn(state, "pufs")))
  );
}

// Fundo mínimo do salão: 1,80 m com móveis; só passagem (1,20 m) sem eles.
export function salonMinDepthMm(state: ProjectState): number {
  return hasFloorFurniture(state) ? SALON_MIN_DEPTH_MM : SALON_TRAFFIC_ONLY_DEPTH_MM;
}

export function computeMinDepthMm(list: CatalogMachine[], salonMm = SALON_MIN_DEPTH_MM): number {
  if (list.length === 0) return 0;
  const maxDepth = Math.max(...list.map((m) => m.depthMm));
  return TECH_AREA_DEFAULT_MM + maxDepth + DRYWALL_THICKNESS_MM + salonMm;
}

export function computeMinCeilingMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  // topo da máquina conta a base de concreto embaixo dela
  // e o espaço livre acima que o fabricante pede (SYC180: 1,10 m)
  return Math.max(...list.map((m) => m.heightMm + machineBaseMm(m) + (m.topClearanceMm ?? CEILING_CLEARANCE_MM)));
}

export function countDryers(resolved: { machine: CatalogMachine; qty: number }[]): number {
  return resolved
    .filter((r) => r.machine.type === "secadora" || r.machine.type === "stack")
    .reduce((sum, r) => sum + r.qty, 0);
}

export function validate(state: ProjectState, catalog: CatalogMachine[]): Violation[] {
  const resolved = resolveSelection(state.machines, catalog);
  const list = flattenSelection(resolved);

  if (list.length === 0) {
    return [
      {
        code: "NO_MACHINES",
        message: "Selecione ao menos uma máquina no catálogo.",
        field: "machines",
        suggestedValueMm: 0,
      },
    ];
  }

  const violations: Violation[] = [];

  // Em orientation="side" a fileira corre ao longo de roomDepthMm (não
  // roomWidthMm), e a área técnica/salão passam a ser medidos na largura —
  // os dois eixos trocam de papel. "along" = parede da fileira, "across" =
  // parede de fundo até a frente.
  const alongField = state.orientation === "side" ? "roomDepthMm" : "roomWidthMm";
  const acrossField = state.orientation === "side" ? "roomWidthMm" : "roomDepthMm";
  const alongLengthMm = state[alongField];
  const acrossLengthMm = state[acrossField];

  // Quando o totem cai do MESMO lado da porta técnica, ele precisa do seu
  // próprio trecho de 50cm além do vão da porta — largura extra.
  const totemSharesDoorSide = isFurnitureOn(state, "totem") && state.totemSide === state.techAccessSide;
  const minAlong = computeMinWidthMm(list, freeEndStripMm(state, list)) + (totemSharesDoorSide ? TOTEM_WALL_MM : 0);
  if (alongLengthMm < minAlong) {
    violations.push({
      code: "WIDTH_TOO_SMALL",
      message: `Espaço insuficiente ao longo da parede das máquinas${
        totemSharesDoorSide ? " + totem do lado da porta técnica" : ""
      }. Mínimo: ${(minAlong / 1000).toFixed(2)}m.`,
      field: alongField,
      suggestedValueMm: minAlong,
    });
  }

  if (isFurnitureOn(state, "table") && alongLengthMm < FURNITURE_BLOCK_WIDTH_MM) {
    violations.push({
      code: "FURNITURE_WIDTH_TOO_SMALL",
      message: `Espaço insuficiente ao longo da parede pra mesa encostada. Mínimo: ${(FURNITURE_BLOCK_WIDTH_MM / 1000).toFixed(2)}m.`,
      field: alongField,
      suggestedValueMm: Math.max(minAlong, FURNITURE_BLOCK_WIDTH_MM),
    });
  }

  const minAcross = computeMinDepthMm(list, salonMinDepthMm(state));
  if (acrossLengthMm < minAcross) {
    violations.push({
      code: "DEPTH_TOO_SMALL",
      message: `Espaço insuficiente (da parede das máquinas até a frente) para área técnica, maquinário e salão. Mínimo: ${(minAcross / 1000).toFixed(2)}m.`,
      field: acrossField,
      suggestedValueMm: minAcross,
    });
  }

  const minCeiling = computeMinCeilingMm(list);
  if (state.ceilingHeightMm < minCeiling) {
    violations.push({
      code: "CEILING_TOO_LOW",
      message: `Pé-direito insuficiente para a máquina mais alta + folga de duto. Mínimo: ${(minCeiling / 1000).toFixed(2)}m.`,
      field: "ceilingHeightMm",
      suggestedValueMm: minCeiling,
    });
  }

  return violations;
}
