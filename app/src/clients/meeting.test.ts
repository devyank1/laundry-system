import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetFakeCatalog } from "../test/fakeSupabase";

vi.mock("../lib/supabaseClient", async () => (await import("../test/fakeSupabase")).fakeSupabaseModule());

import { refreshCatalog } from "../catalog/store";
import { CATALOG_SEED } from "../catalog/seed";
import { initialProjectState, useProjectStore } from "../state/projectStore";
import { useRoiStore } from "../roi/roiStore";
import { useInsightsStore } from "../insights/insightsStore";
import { defaultRoiState } from "../roi/model";
import { defaultInsightsInputs } from "../insights/model";
import { applyMeeting, captureMeeting, MEETING_VERSION } from "./meeting";
import { useMeetingSession } from "./sessionStore";

const machineId = CATALOG_SEED[0].id;

beforeEach(async () => {
  localStorage.clear();
  resetFakeCatalog();
  await refreshCatalog();
  useProjectStore.setState({ ...initialProjectState, logoDataUrl: null });
  useRoiStore.getState().replaceAll(defaultRoiState());
  useInsightsStore.getState().replaceAll(defaultInsightsInputs());
});

describe("captureMeeting / applyMeeting", () => {
  it("reaplicar devolve exatamente o que foi capturado", () => {
    useProjectStore.setState({ roomWidthMm: 6200, machines: [{ catalogId: machineId, qty: 3 }], facadeColor: "#123456", logoStyle: "flat" });
    useRoiStore.getState().setOp("preco", 19.9);
    useInsightsStore.getState().setField("cycles", "42");
    const snap = captureMeeting();
    expect(snap.v).toBe(MEETING_VERSION);
    expect(JSON.stringify(snap)).not.toContain("logoDataUrl");

    useProjectStore.setState({ ...initialProjectState, facadeColor: "#000000" });
    useRoiStore.getState().setOp("preco", 1);
    useInsightsStore.getState().setField("cycles", "1");

    const { removed } = applyMeeting(JSON.parse(JSON.stringify(snap)), "data:image/webp;base64,AAA");
    expect(removed).toEqual([]);
    expect(captureMeeting()).toEqual(snap);
    expect(useProjectStore.getState().logoDataUrl).toBe("data:image/webp;base64,AAA");
  });

  it("reunião salva por versão antiga (campos faltando) abre completando com o padrão", () => {
    expect(() => applyMeeting({ v: 1, project: { roomWidthMm: 5000 } }, null)).not.toThrow();
    const now = captureMeeting();
    expect(now.project.roomWidthMm).toBe(5000);
    expect(now.project.roomDepthMm).toBe(initialProjectState.roomDepthMm);
    expect(now.roi).toEqual(defaultRoiState());
    expect(now.insights).toEqual(defaultInsightsInputs());
    expect(useProjectStore.getState().logoDataUrl).toBeNull();
  });

  it("máquina que saiu do catálogo é retirada e avisada", () => {
    const { removed } = applyMeeting({ v: 1, project: { machines: [{ catalogId: "sumiu", qty: 2 }, { catalogId: machineId, qty: 1 }] } }, null);
    expect(removed).toEqual(["sumiu"]);
    expect(useProjectStore.getState().machines).toEqual([{ catalogId: machineId, qty: 1 }]);
  });

  it("lixo não quebra a tela", () => {
    expect(() => applyMeeting("nada", null)).not.toThrow();
    expect(() => applyMeeting(null, null)).not.toThrow();
  });

  it("depois de aplicar, o ROI não é sobrescrito pela sincronização com a planta", () => {
    useProjectStore.setState({ machines: [{ catalogId: machineId, qty: 2 }] });
    useRoiStore.getState().setOp("preco", 33);
    const snap = captureMeeting();
    applyMeeting(snap, null);
    const sync = JSON.parse(localStorage.getItem("lavanderia.plantSync.v1") ?? "{}");
    expect(sync.roi).toBeTruthy();
    expect(sync.roi).toBe(sync.insights);
  });
});

describe("useMeetingSession", () => {
  it("só conta como alterada depois de mexer na tela", () => {
    useMeetingSession.getState().bind({ id: "c1", name: "Lava Já", canSave: true });
    expect(useMeetingSession.getState().isDirty()).toBe(false);
    useProjectStore.setState({ roomWidthMm: 9999 });
    expect(useMeetingSession.getState().isDirty()).toBe(true);
    useMeetingSession.getState().markSaved();
    expect(useMeetingSession.getState().isDirty()).toBe(false);
    useProjectStore.setState({ logoDataUrl: "data:image/png;base64,BB" });
    expect(useMeetingSession.getState().isDirty()).toBe(true);
  });

  it("fechar não esconde alterações não salvas", () => {
    useMeetingSession.getState().bind({ id: "c1", name: "Lava Já", canSave: true });
    useProjectStore.setState({ roomWidthMm: 7777 });
    useMeetingSession.getState().unbind();
    expect(useMeetingSession.getState().isDirty()).toBe(true);
  });

  it("fechar desliga o cliente", () => {
    useMeetingSession.getState().bind({ id: "c1", name: "Lava Já", canSave: false });
    expect(useMeetingSession.getState()).toMatchObject({ clientId: "c1", clientName: "Lava Já", canSave: false });
    useMeetingSession.getState().unbind();
    expect(useMeetingSession.getState().clientId).toBeNull();
  });
});
