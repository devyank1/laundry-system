import { create } from "zustand";
import { OBRA_STEPS } from "./steps";

// Andamento da obra: doneAt[i] = quando a etapa i foi concluída (ISO).
// Etapas são concluídas em ordem, então o tamanho da lista é a etapa atual.
const STORAGE_KEY = "lavanderia.obra.v1";

export interface ObraState {
  doneAt: string[];
}

export function normalizeObra(raw: unknown): ObraState {
  const list = raw && typeof raw === "object" ? (raw as { doneAt?: unknown }).doneAt : undefined;
  if (!Array.isArray(list)) return { doneAt: [] };
  const doneAt: string[] = [];
  for (const v of list) {
    if (typeof v !== "string" || Number.isNaN(Date.parse(v))) break; // em ordem: para no primeiro inválido
    doneAt.push(v);
    if (doneAt.length === OBRA_STEPS.length) break;
  }
  return { doneAt };
}

function load(): ObraState {
  try {
    return normalizeObra(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return { doneAt: [] };
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
    complete: (now = new Date()) => {
      const { doneAt } = get();
      if (doneAt.length >= OBRA_STEPS.length) return;
      apply({ doneAt: [...doneAt, now.toISOString()] });
    },
    undo: () => {
      const { doneAt } = get();
      if (doneAt.length) apply({ doneAt: doneAt.slice(0, -1) });
    },
    reset: () => apply({ doneAt: [] }),
    replaceAll: (s) => apply(normalizeObra(s)),
  };
});
