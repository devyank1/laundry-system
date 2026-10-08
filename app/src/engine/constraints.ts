import {
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  TECH_AREA_DEFAULT_MM,
  DRYWALL_THICKNESS_MM,
  SALON_MIN_DEPTH_MM,
  CEILING_CLEARANCE_MM,
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
  return machineRowWidthMm(list) + LATERAL_CLEARANCE_MM * 2;
}

export function computeMinDepthMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  const maxDepth = Math.max(...list.map((m) => m.depthMm));
  return TECH_AREA_DEFAULT_MM + maxDepth + DRYWALL_THICKNESS_MM + SALON_MIN_DEPTH_MM;
}

export function computeMinCeilingMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  const maxHeight = Math.max(...list.map((m) => m.heightMm));
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

  const minWidth = computeMinWidthMm(list);
  if (state.roomWidthMm < minWidth) {
    violations.push({
      code: "WIDTH_TOO_SMALL",
      message: `Largura insuficiente para o maquinário escolhido. Mínimo: ${(minWidth / 1000).toFixed(2)}m.`,
      field: "roomWidthMm",
      suggestedValueMm: minWidth,
    });
  }

  const minDepth = computeMinDepthMm(list);
  if (state.roomDepthMm < minDepth) {
    violations.push({
      code: "DEPTH_TOO_SMALL",
      message: `Profundidade insuficiente para área técnica, maquinário e salão. Mínimo: ${(minDepth / 1000).toFixed(2)}m.`,
      field: "roomDepthMm",
      suggestedValueMm: minDepth,
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
