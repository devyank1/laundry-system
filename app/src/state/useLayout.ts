import { useMemo, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "./projectStore";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import { computeLayout } from "../engine/layout";
import type { LayoutResult, ProjectState } from "../engine/types";

// Só os campos que o motor de layout lê. Cor da fachada, iluminação, logo etc.
// ficam de fora: mudar qualquer um deles NÃO recalcula a planta (e não refaz o
// 3D inteiro à toa).
function engineState(s: ProjectState): ProjectState {
  return {
    roomWidthMm: s.roomWidthMm,
    roomDepthMm: s.roomDepthMm,
    ceilingHeightMm: s.ceilingHeightMm,
    orientation: s.orientation,
    machines: s.machines,
    doorEnabled: s.doorEnabled,
    techAccessSide: s.techAccessSide,
    furnitureEnabled: s.furnitureEnabled,
    totemSide: s.totemSide,
    tableSide: s.tableSide,
    chairsSide: s.chairsSide,
    acSide: s.acSide,
    machineWall: s.machineWall,
    tableSlot: s.tableSlot,
    chairsSlot: s.chairsSlot,
    acSlot: s.acSlot,
    counterSide: s.counterSide,
    counterSlot: s.counterSlot,
    acOverrideBTU: s.acOverrideBTU,
  };
}

export function useLayout(): LayoutResult {
  const state = useProjectStore(useShallow(engineState));
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);

  return useMemo(() => computeLayout(state, catalog), [state, catalog]);
}
