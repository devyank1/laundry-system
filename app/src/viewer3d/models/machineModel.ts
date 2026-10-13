export type MachineModel =
  | { kind: "speedQueen" }
  | { kind: "tower"; finish: "white" | "silver" };

// Speed Queen usa o modelo próprio; Mamute e máquinas cadastradas usam a torre.
export function machineModelFor(catalogId: string): MachineModel {
  if (catalogId === "sq-stack") return { kind: "speedQueen" };
  if (catalogId === "mamute-smart17") return { kind: "tower", finish: "silver" };
  return { kind: "tower", finish: "white" };
}
