import { getCatalog } from "../catalog/store";
import type { MachineSelection, ProjectState } from "../engine/types";
import { normalizeInsights, useInsightsStore } from "../insights/insightsStore";
import { normalizeObra, useObraStore, type ObraState } from "../obra/obraStore";
import type { InsightsInputs } from "../insights/model";
import { markPlantSynced } from "../plantLink";
import type { RoiState } from "../roi/model";
import { normalizeRoi, useRoiStore } from "../roi/roiStore";
import { initialFacadeState, initialProjectState, useProjectStore, type FacadeState } from "../state/projectStore";

// Reunião salva = estado da tela (números e escolhas), não imagens. Ao
// reabrir, planta/3D/PDF são redesenhados a partir daqui. A logo vai à parte
// (Storage), nunca dentro do JSON.
export const MEETING_VERSION = 1;

export interface MeetingSnapshot {
  v: 1;
  project: ProjectState & FacadeState;
  roi: RoiState;
  insights: InsightsInputs;
  /** Diário de Obra; reuniões antigas não têm (abre zerado). */
  obra?: ObraState;
}

const PROJECT_DEFAULTS: ProjectState & FacadeState = { ...initialProjectState, ...initialFacadeState };
const PROJECT_KEYS = [...Object.keys(PROJECT_DEFAULTS), "furnitureOff"] as (keyof (ProjectState & FacadeState))[];

export function captureMeeting(): MeetingSnapshot {
  const s = useProjectStore.getState();
  const project = {} as Record<string, unknown>;
  for (const k of PROJECT_KEYS) if (s[k] !== undefined) project[k] = structuredClone(s[k]);
  const r = useRoiStore.getState();
  const i = useInsightsStore.getState();
  return {
    v: MEETING_VERSION,
    project: project as unknown as MeetingSnapshot["project"],
    roi: structuredClone({ equip: r.equip, infra: r.infra, fixo: r.fixo, op: r.op, cost: r.cost, pay: r.pay }),
    insights: structuredClone({
      fleet: i.fleet, cycles: i.cycles, needplaca: i.needplaca, issues: i.issues, visitcost: i.visitcost, pct: i.pct,
      downdays: i.downdays, gwprice: i.gwprice, gwqty: i.gwqty, boardprice: i.boardprice, licprice: i.licprice,
    }),
    obra: { doneAt: [...useObraStore.getState().doneAt] },
  };
}

// Só aceita campos conhecidos e do mesmo tipo do padrão; o resto vem do padrão.
function normalizeProject(raw: unknown): ProjectState & FacadeState {
  const out: Record<string, unknown> = { ...structuredClone(PROJECT_DEFAULTS) };
  if (!raw || typeof raw !== "object") return out as unknown as ProjectState & FacadeState;
  const p = raw as Record<string, unknown>;
  for (const k of PROJECT_KEYS) {
    const v = p[k];
    if (v === undefined) continue;
    const d = (PROJECT_DEFAULTS as unknown as Record<string, unknown>)[k];
    if (k === "machines" || k === "furnitureOff") {
      if (Array.isArray(v)) out[k] = structuredClone(v);
    } else if (k === "acOverrideBTU") {
      if (v === null || typeof v === "number") out[k] = v;
    } else if (typeof v === typeof d) {
      out[k] = v;
    }
  }
  return out as unknown as ProjectState & FacadeState;
}

export function applyMeeting(raw: unknown, logoDataUrl: string | null): { removed: string[] } {
  const snap = (raw && typeof raw === "object" ? raw : {}) as Partial<MeetingSnapshot>;
  const project = normalizeProject(snap.project);
  const catalog = getCatalog();
  const known = new Set(catalog.map((m) => m.id));
  const machines = (project.machines as MachineSelection[]).filter(
    (m) => m && typeof m.catalogId === "string" && typeof m.qty === "number",
  );
  const removed = machines.filter((m) => !known.has(m.catalogId)).map((m) => m.catalogId);
  project.machines = machines.filter((m) => known.has(m.catalogId));

  const next = { ...project } as Record<string, unknown>;
  if (!("furnitureOff" in (snap.project ?? {}))) next.furnitureOff = undefined;
  useProjectStore.setState({ ...(next as Partial<ProjectState & FacadeState>), logoDataUrl });
  useRoiStore.getState().replaceAll(normalizeRoi(snap.roi));
  useInsightsStore.getState().replaceAll(normalizeInsights(snap.insights));
  useObraStore.getState().replaceAll(normalizeObra(snap.obra));
  // O ROI/Conectividade da reunião valem: a sincronização com a planta não
  // pode sobrescrever ao detectar a planta "nova".
  markPlantSynced(project.machines, catalog);
  return { removed };
}

/** Retrato do que está na tela (pra saber se há algo não salvo). */
export function meetingFingerprint(): string {
  return JSON.stringify(captureMeeting()) + "|" + (useProjectStore.getState().logoDataUrl ?? "");
}
