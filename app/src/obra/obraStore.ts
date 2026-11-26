import { create } from "zustand";
import { OBRA_STEPS } from "./steps";

// Andamento da obra: doneAt[i] = quando a etapa i foi concluída (ISO).
// Etapas são concluídas em ordem, então o tamanho da lista é a etapa atual.
// checked: ids dos itens de checklist marcados (ex.: "1a").
const STORAGE_KEY = "lavanderia.obra.v1";

export interface ObraState {
  doneAt: string[];
  checked: string[];
}

const CHECK_IDS = new Set(OBRA_STEPS.flatMap((s) => (s.checklist ?? []).map((c) => c.id)));

function stepAllChecked(i: number, checked: string[]): boolean {
  return (OBRA_STEPS[i]?.checklist ?? []).every((c) => checked.includes(c.id));
}

export function normalizeObra(raw: unknown): ObraState {
  const obj = raw && typeof raw === "object" ? (raw as { doneAt?: unknown; checked?: unknown }) : {};
  const checked = Array.isArray(obj.checked)
    ? [...new Set(obj.checked.filter((v): v is string => typeof v === "string" && CHECK_IDS.has(v)))]
    : [];
  return { doneAt: normalizeDone(obj.doneAt), checked };
}

function normalizeDone(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const doneAt: string[] = [];
  for (const v of list) {
    if (typeof v !== "string" || Number.isNaN(Date.parse(v))) break; // em ordem: para no primeiro inválido
    doneAt.push(v);
    if (doneAt.length === OBRA_STEPS.length) break;
  }
  return doneAt;
}

function load(): ObraState {
  try {
    return normalizeObra(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return { doneAt: [], checked: [] };
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
  /** Conclui a etapa atual (exige o checklist todo marcado). */
  complete: (now?: Date) => void;
  undo: () => void;
  reset: () => void;
  replaceAll: (s: ObraState) => void;
}

export const useObraStore = create<ObraStore>((set, get) => {
  const apply = (s: ObraState) => {
    save(s);
    set(s);
  };
  return {
    ...load(),
    toggle: (id) => {
      const { doneAt, checked } = get();
      const current = OBRA_STEPS[doneAt.length];
      if (!current?.checklist?.some((c) => c.id === id)) return;
      apply({ doneAt, checked: checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id] });
    },
    complete: (now = new Date()) => {
      const { doneAt, checked } = get();
      if (doneAt.length >= OBRA_STEPS.length || !stepAllChecked(doneAt.length, checked)) return;
      apply({ doneAt: [...doneAt, now.toISOString()], checked });
    },
    undo: () => {
      const { doneAt, checked } = get();
      if (doneAt.length) apply({ doneAt: doneAt.slice(0, -1), checked });
    },
    reset: () => apply({ doneAt: [], checked: [] }),
    replaceAll: (s) => apply(normalizeObra(s)),
  };
});
