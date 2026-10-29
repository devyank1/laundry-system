import {
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  TECH_AREA_DEFAULT_MM,
  DRYWALL_THICKNESS_MM,
  SALON_MIN_DEPTH_MM,
  CEILING_CLEARANCE_MM,
  FURNITURE_BLOCK_WIDTH_MM,
  TECH_DOOR_WIDTH_MM,
  TOTEM_WALL_MM,
  machineBaseMm,
} from "./constants";
import type { CatalogMachine, MachineSelection, ProjectState, Violation } from "./types";

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

export function computeMinWidthMm(list: CatalogMachine[]): number {
  // Recuo de 50cm do lado do totem (lado oposto à porta técnica) + fileira +
  // porta técnica de 70cm (já cobre, com folga, os 50cm desse outro lado).
  return LATERAL_CLEARANCE_MM + machineRowWidthMm(list) + TECH_DOOR_WIDTH_MM;
}

export function computeMinDepthMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  const maxDepth = Math.max(...list.map((m) => m.depthMm));
  return TECH_AREA_DEFAULT_MM + maxDepth + DRYWALL_THICKNESS_MM + SALON_MIN_DEPTH_MM;
}

export function computeMinCeilingMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  // topo da máquina conta a base de concreto embaixo dela
  const maxHeight = Math.max(...list.map((m) => m.heightMm + machineBaseMm(m)));
  return maxHeight + CEILING_CLEARANCE_MM;
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
  const totemSharesDoorSide = state.furnitureEnabled && state.totemSide === state.techAccessSide;
  const minAlong = computeMinWidthMm(list) + (totemSharesDoorSide ? TOTEM_WALL_MM : 0);
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

  if (state.furnitureEnabled && alongLengthMm < FURNITURE_BLOCK_WIDTH_MM) {
    violations.push({
      code: "FURNITURE_WIDTH_TOO_SMALL",
      message: `Espaço insuficiente ao longo da parede pra mesa encostada. Mínimo: ${(FURNITURE_BLOCK_WIDTH_MM / 1000).toFixed(2)}m.`,
      field: alongField,
      suggestedValueMm: Math.max(minAlong, FURNITURE_BLOCK_WIDTH_MM),
    });
  }

  const minAcross = computeMinDepthMm(list);
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
