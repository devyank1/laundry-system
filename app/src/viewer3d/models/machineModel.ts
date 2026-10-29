export type MachineModel =
  | { kind: "speedQueen" }
  | { kind: "speedQueenSsu" }
  | { kind: "speedQueenSyc" }
  | { kind: "speedQueenSt" }
  | { kind: "lg" }
  | { kind: "tower"; finish: "white" | "silver" };

// Speed Queen e LG usam modelos próprios; Mamute e máquinas cadastradas usam a torre.
export function machineModelFor(catalogId: string): MachineModel {
  if (catalogId === "sq-ssu030") return { kind: "speedQueenSsu" };
  if (catalogId === "sq-syc180") return { kind: "speedQueenSyc" };
  if (catalogId === "sq-st055") return { kind: "speedQueenSt" };
  if (catalogId.startsWith("sq-")) return { kind: "speedQueen" };
  if (catalogId.startsWith("lg-")) return { kind: "lg" };
  if (catalogId === "mamute-smart17") return { kind: "tower", finish: "silver" };
  return { kind: "tower", finish: "white" };
}
