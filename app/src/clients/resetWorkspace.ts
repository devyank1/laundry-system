import { useInsightsStore } from "../insights/insightsStore";
import { useRoiStore } from "../roi/roiStore";
import { initialFacadeState, initialProjectState, useProjectStore } from "../state/projectStore";
import { useMeetingSession } from "./sessionStore";

/** Conta saiu ou trocou (não conta o carregamento inicial). */
export function workspaceOwnerChanged(prev: string | null | undefined, next: string | null | undefined): boolean {
  return typeof prev === "string" && prev !== next;
}

// Nada de um cliente (nome, logo, planta, ROI) fica na tela pra próxima
// pessoa que entrar no mesmo aparelho.
export function resetWorkspace(): void {
  useMeetingSession.getState().unbind();
  useProjectStore.setState({ ...structuredClone(initialProjectState), ...initialFacadeState, logoDataUrl: null });
  useRoiStore.getState().reset();
  useInsightsStore.getState().reset();
  useMeetingSession.getState().markSaved();
}
