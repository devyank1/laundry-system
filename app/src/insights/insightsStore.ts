import { create } from "zustand";
import { defaultInsightsInputs, type InsightsInputs, type TierId } from "./model";

const STORAGE_KEY = "lavanderia.insights.v1";

function load(): InsightsInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultInsightsInputs();
    return normalizeInsights(JSON.parse(raw));
  } catch {
    return defaultInsightsInputs();
  }
}

// Completa um Conectividade salvo (localStorage ou reunião de cliente).
export function normalizeInsights(raw: unknown): InsightsInputs {
  const base = defaultInsightsInputs();
  if (!raw || typeof raw !== "object") return base;
  try {
    const p = raw as Partial<InsightsInputs>;
    const out = { ...base, ...p, fleet: { ...base.fleet, ...p.fleet } };
    // só aceita texto; qualquer outra coisa salva por engano volta ao padrão
    (Object.keys(base) as (keyof InsightsInputs)[]).forEach((k) => {
      if (k !== "fleet" && typeof out[k] !== "string") (out as Record<string, unknown>)[k] = base[k];
    });
    return out;
  } catch {
    return base;
  }
}

function save(s: InsightsInputs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

type Field = Exclude<keyof InsightsInputs, "fleet">;

interface InsightsStore extends InsightsInputs {
  setField: (key: Field, value: string) => void;
  setFleet: (id: TierId, value: string) => void;
  reset: () => void;
  replaceAll: (state: InsightsInputs) => void;
}

export const useInsightsStore = create<InsightsStore>((set, get) => {
  const snapshot = (): InsightsInputs => {
    const { fleet, cycles, needplaca, issues, visitcost, pct, downdays, gwprice, gwqty, boardprice, licprice } = get();
    return { fleet, cycles, needplaca, issues, visitcost, pct, downdays, gwprice, gwqty, boardprice, licprice };
  };
  const apply = (patch: Partial<InsightsInputs>) => {
    set(patch);
    save(snapshot());
  };
  return {
    ...load(),
    setField: (key, value) => apply({ [key]: value }),
    setFleet: (id, value) => apply({ fleet: { ...get().fleet, [id]: value } }),
    reset: () => apply(defaultInsightsInputs()),
    replaceAll: (state) => apply(normalizeInsights(state)),
  };
});
