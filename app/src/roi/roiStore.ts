import { create } from "zustand";
import { defaultRoiState, num, sumFixo, type RoiState } from "./model";

const STORAGE_KEY = "lavanderia.roi.v1";

function load(): RoiState {
  const base = defaultRoiState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<RoiState>;
    // Mescla com os valores iniciais: salvo de versão antiga não quebra a tela.
    return {
      equip: Array.isArray(p.equip) && p.equip.length ? p.equip : base.equip,
      infra: Array.isArray(p.infra) ? p.infra : base.infra,
      fixo: Array.isArray(p.fixo) ? p.fixo : base.fixo,
      op: { ...base.op, ...p.op },
      cost: { ...base.cost, ...p.cost },
      pay: { ...base.pay, ...p.pay },
    };
  } catch {
    return base;
  }
}

function save(s: RoiState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ equip: s.equip, infra: s.infra, fixo: s.fixo, op: s.op, cost: s.cost, pay: s.pay }),
    );
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

type Section = "op" | "cost" | "pay";

interface RoiStore extends RoiState {
  setOp: <K extends keyof RoiState["op"]>(key: K, value: RoiState["op"][K]) => void;
  setCost: <K extends keyof RoiState["cost"]>(key: K, value: RoiState["cost"][K]) => void;
  setPay: <K extends keyof RoiState["pay"]>(key: K, value: RoiState["pay"][K]) => void;
  setEquip: (i: number, patch: Partial<RoiState["equip"][number]>) => void;
  setInfra: (i: number, patch: Partial<RoiState["infra"][number]>) => void;
  addInfra: () => void;
  removeInfra: (i: number) => void;
  setFixo: (i: number, patch: Partial<RoiState["fixo"][number]>) => void;
  addFixo: () => void;
  removeFixo: (i: number) => void;
  reset: () => void;
}

export const useRoiStore = create<RoiStore>((set) => {
  const update = (fn: (s: RoiStore) => Partial<RoiState>) =>
    set((s) => {
      const next = fn(s);
      save({ ...s, ...next });
      return next;
    });
  const setSection =
    (section: Section) =>
    (key: string, value: unknown) =>
      update((s) => ({ [section]: { ...s[section], [key]: value } }) as Partial<RoiState>);

  return {
    ...load(),
    setOp: setSection("op") as RoiStore["setOp"],
    setCost: setSection("cost") as RoiStore["setCost"],
    setPay: setSection("pay") as RoiStore["setPay"],
    setEquip: (i, patch) =>
      update((s) => ({
        // quantidade, preço e bocas nunca ficam negativos
        equip: s.equip.map((e, k) => {
          if (k !== i) return e;
          const n = { ...e, ...patch };
          return { ...n, qtd: Math.max(0, num(n.qtd)), preco: Math.max(0, num(n.preco)), cb: Math.max(0, num(n.cb)) };
        }),
      })),
    setInfra: (i, patch) => update((s) => ({ infra: s.infra.map((it, k) => (k === i ? { ...it, ...patch } : it)) })),
    addInfra: () => update((s) => ({ infra: [...s.infra, { nome: "Novo item", tipo: "fixo", val: 0 }] })),
    removeInfra: (i) => update((s) => ({ infra: s.infra.filter((_, k) => k !== i) })),
    // Mexer num item de custo fixo recalcula o total (arredondado), como no original;
    // o total continua editável à mão até o próximo ajuste de item.
    setFixo: (i, patch) =>
      update((s) => {
        const fixo = s.fixo.map((x, k) => (k === i ? { ...x, ...patch } : x));
        return { fixo, cost: { ...s.cost, fixoTotal: sumFixo(fixo) } };
      }),
    addFixo: () =>
      update((s) => {
        const fixo = [...s.fixo, { nome: "Novo custo", val: 0 }];
        return { fixo, cost: { ...s.cost, fixoTotal: sumFixo(fixo) } };
      }),
    removeFixo: (i) =>
      update((s) => {
        const fixo = s.fixo.filter((_, k) => k !== i);
        return { fixo, cost: { ...s.cost, fixoTotal: sumFixo(fixo) } };
      }),
    reset: () => update(() => defaultRoiState()),
  };
});
