import { describe, expect, it } from "vitest";
import { initialProjectState, useProjectStore } from "../state/projectStore";
import { useRoiStore } from "../roi/roiStore";
import { defaultRoiState } from "../roi/model";
import { useMeetingSession } from "./sessionStore";
import { resetWorkspace, workspaceOwnerChanged } from "./resetWorkspace";

describe("resetWorkspace", () => {
  it("só limpa quando a conta muda ou sai", () => {
    expect(workspaceOwnerChanged(undefined, "u1")).toBe(false);
    expect(workspaceOwnerChanged(null, "u1")).toBe(false);
    expect(workspaceOwnerChanged("u1", "u1")).toBe(false);
    expect(workspaceOwnerChanged("u1", null)).toBe(true);
    expect(workspaceOwnerChanged("u1", "u2")).toBe(true);
  });

  it("tira da tela o cliente, a logo, a planta e o ROI da conta anterior", () => {
    useMeetingSession.getState().bind({ id: "c1", name: "Lava Já", canSave: true });
    useProjectStore.setState({ roomWidthMm: 9999, logoDataUrl: "data:image/png;base64,AA", facadeColor: "#000000" });
    useRoiStore.getState().setOp("preco", 77);
    resetWorkspace();
    expect(useMeetingSession.getState().clientId).toBeNull();
    expect(useProjectStore.getState()).toMatchObject({ roomWidthMm: initialProjectState.roomWidthMm, logoDataUrl: null, facadeColor: "#8fa892" });
    expect(useRoiStore.getState().op).toEqual(defaultRoiState().op);
  });
});
