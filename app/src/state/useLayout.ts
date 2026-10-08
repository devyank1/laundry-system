import { useMemo, useSyncExternalStore } from "react";
import { useProjectStore } from "./projectStore";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import { computeLayout } from "../engine/layout";
import type { LayoutResult } from "../engine/types";

export function useLayout(): LayoutResult {
  const state = useProjectStore();
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);

  return useMemo(() => computeLayout(state, catalog), [state, catalog]);
}
