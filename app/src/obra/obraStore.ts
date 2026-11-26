import { create } from "zustand";
import { OBRA_STEPS, type ObraStep } from "./steps";

// Andamento da obra, por id de etapa (não por posição: inserir etapas não
// bagunça reuniões salvas).
// doneAt: id da etapa -> quando foi concluída (ISO).
// checked: ids dos itens de checklist marcados (ex.: "ponto-a").
// extras: materiais extras digitados na etapa de compras, com "comprado".
const STORAGE_KEY = "lavanderia.obra.v2";
export const EXTRA_MAX = 50;
export const EXTRA_MAX_LEN = 120;

export interface ExtraMaterial {
  text: string;
  bought: boolean;
}

export interface ObraState {
  doneAt: Record<string, string>;
  checked: string[];
  extras: ExtraMaterial[];
}

const STEP_IDS = new Set(OBRA_STEPS.map((s) => s.id));
const CHECK_IDS = new Set(OBRA_STEPS.flatMap((s) => (s.checklist ?? []).map((c) => c.id)));

const empty = (): ObraState => ({ doneAt: {}, checked: [], extras: [] });

/** Posição da etapa atual (primeira não concluída); = total quando tudo concluído. */
export function currentIndex(doneAt: Record<string, string>): number {
  const i = OBRA_STEPS.findIndex((s) => !doneAt[s.id]);
  return i === -1 ? OBRA_STEPS.length : i;
}

/** Checklist obrigatório todo marcado (opcional nunca trava). */
export function canComplete(step: ObraStep, checked: string[]): boolean {
  if (step.optionalChecklist) return true;
  return (step.checklist ?? []).every((c) => checked.includes(c.id));
}

function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, EXTRA_MAX_LEN);
  return t ? t : null;
}

// Aceita { text, bought } ou só o texto.
function cleanExtra(v: unknown): ExtraMaterial | null {
  if (typeof v === "string") {
    const text = cleanText(v);
    return text ? { text, bought: false } : null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as { text?: unknown; bought?: unknown };
  const text = cleanText(o.text);
  return text ? { text, bought: o.bought === true } : null;
}

export function normalizeObra(raw: unknown): ObraState {
  if (!raw || typeof raw !== "object") return empty();
  const obj = raw as { doneAt?: unknown; checked?: unknown; extras?: unknown };
  const doneAt: Record<string, string> = {};
  if (obj.doneAt && typeof obj.doneAt === "object" && !Array.isArray(obj.doneAt)) {
    for (const [k, v] of Object.entries(obj.doneAt as Record<string, unknown>)) {
      if (STEP_IDS.has(k) && typeof v === "string" && !Number.isNaN(Date.parse(v))) doneAt[k] = v;
    }
  }
  const checked = Array.isArray(obj.checked)
    ? [...new Set(obj.checked.filter((v): v is string => typeof v === "string" && CHECK_IDS.has(v)))]
    : [];
  const extras = Array.isArray(obj.extras)
    ? obj.extras.map(cleanExtra).filter((v): v is ExtraMaterial => v !== null).slice(0, EXTRA_MAX)
    : [];
  return { doneAt, checked, extras };
}

function load(): ObraState {
  try {
    return normalizeObra(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return empty();
  }
}

function save(s: ObraState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

interface ObraStore extends ObraState {
  /** Marca/desmarca item do checklist; só da etapa atual. */
  toggle: (id: string) => void;
  /** Conclui a etapa atual (checklist obrigatório todo marcado). */
  complete: (now?: Date) => void;
  /** Volta a etapa concluída logo antes da atual. */
  undo: () => void;
  addExtra: (text: string) => void;
  /** Marca/desmarca o material como comprado. */
  toggleExtra: (index: number) => void;
  removeExtra: (index: number) => void;
  reset: () => void;
  replaceAll: (s: ObraState) => void;
}

export const useObraStore = create<ObraStore>((set, get) => {
  const state = (): ObraState => {
    const { doneAt, checked, extras } = get();
    return { doneAt, checked, extras };
  };
  const apply = (patch: Partial<ObraState>) => {
    const next = { ...state(), ...patch };
    save(next);
    set(next);
  };
  return {
    ...load(),
    toggle: (id) => {
      const { doneAt, checked } = get();
      const current = OBRA_STEPS[currentIndex(doneAt)];
      if (!current?.checklist?.some((c) => c.id === id)) return;
      apply({ checked: checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id] });
    },
    complete: (now = new Date()) => {
      const { doneAt, checked } = get();
      const current = OBRA_STEPS[currentIndex(doneAt)];
      if (!current || !canComplete(current, checked)) return;
      apply({ doneAt: { ...doneAt, [current.id]: now.toISOString() } });
    },
    undo: () => {
      const { doneAt } = get();
      const prev = OBRA_STEPS[currentIndex(doneAt) - 1];
      if (!prev) return;
      const next = { ...doneAt };
      delete next[prev.id];
      apply({ doneAt: next });
    },
    addExtra: (text) => {
      const t = cleanText(text);
      const { extras } = get();
      if (t && extras.length < EXTRA_MAX) apply({ extras: [...extras, { text: t, bought: false }] });
    },
    toggleExtra: (index) => {
      const { extras } = get();
      if (index >= 0 && index < extras.length)
        apply({ extras: extras.map((m, i) => (i === index ? { ...m, bought: !m.bought } : m)) });
    },
    removeExtra: (index) => {
      const { extras } = get();
      if (index >= 0 && index < extras.length) apply({ extras: extras.filter((_, i) => i !== index) });
    },
    reset: () => apply(empty()),
    replaceAll: (s) => apply(normalizeObra(s)),
  };
});
