import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getCatalog, subscribeCatalog } from "./catalog/store";
import type { CatalogMachine, MachineSelection } from "./engine/types";
import { TIERS, type TierId } from "./insights/model";
import type { RoiEquip } from "./roi/model";
import { useInsightsStore } from "./insights/insightsStore";
import { useRoiStore } from "./roi/roiStore";
import { useProjectStore } from "./state/projectStore";

// Liga a planta (máquinas escolhidas na barra lateral) às calculadoras de
// Retorno (ROI) e Conectividade: 3 máquinas na planta = 3 equipamentos no ROI
// e as bocas correspondentes na Conectividade.
//
// - Quando a planta muda, as duas calculadoras seguem sozinhas.
// - Mexer à mão nas calculadoras vale até a próxima mudança da planta (ou até
//   o botão "Ajustar à planta").

export interface PlantMachine {
  label: string;
  brand: string;
  model: string;
  type: CatalogMachine["type"];
  qty: number;
  kg: number;
  /** bocas por máquina: stack = lavadora + secadora */
  bocas: number;
  /** capacidade de cada boca (kg): stack = [lavadora, secadora] */
  bocasKg: number[];
}

/** Capacidade da máquina em kg: campo do catálogo, senão o número do modelo ("Smart 17"), senão 10. */
export function machineKg(m: CatalogMachine): number {
  if (m.capacityKg && m.capacityKg > 0) return m.capacityKg;
  const n = /(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*$/i.exec(m.model);
  const v = n ? parseFloat(n[1].replace(",", ".")) : NaN;
  return Number.isFinite(v) && v > 0 && v < 100 ? v : 10;
}

export function plantMachines(selection: MachineSelection[], catalog: CatalogMachine[]): PlantMachine[] {
  return selection
    .filter((s) => s.qty > 0)
    .flatMap((s) => {
      const m = catalog.find((c) => c.id === s.catalogId);
      if (!m) return [];
      const kg = machineKg(m);
      const bocasKg = m.type === "stack" ? [kg, m.dryerCapacityKg ?? kg] : [kg];
      return [{ label: `${m.brand} ${m.model}`, brand: m.brand, model: m.model, type: m.type, qty: s.qty, kg, bocas: bocasKg.length, bocasKg }];
    });
}

/** Faixa de tamanho da Conectividade: ≤12, 13–18, 19–23, >23 kg. */
export function tierOf(kg: number): TierId {
  if (kg <= 12) return "p";
  if (kg <= 18) return "m";
  if (kg <= 23) return "g";
  return "x";
}

const TIER_ORDER = TIERS.map((t) => t.id);

/** Maior capacidade escrita no título/descrição do equipamento do ROI ("2 × 13,6 kg" → 13,6). */
function equipKg(e: RoiEquip): number | null {
  const nome = `${e.nome} ${e.modelo ?? ""}`;
  const all = [...nome.matchAll(/(\d+(?:,\d+)?)\s*kg/gi)].map((m) => parseFloat(m[1].replace(",", ".")));
  return all.length ? Math.max(...all) : null;
}

// Linhas do ROI de uma marca específica ("LG Titan ..."): só recebem máquinas
// dessa marca e modelo; as genéricas ("Chassi pequeno ...") vão por tamanho.
const BRAND_ROWS = ["LG", "Mamute"];

const isBrandRow = (nome: string) => BRAND_ROWS.some((b) => nome.toUpperCase().startsWith(`${b.toUpperCase()} `));

/** Linha da marca e modelo da máquina ("LG Titan Stack" → "LG Titan"); com
 *  várias do mesmo modelo ("Mamute Smart 10/17"), a de mesma capacidade. */
function brandRowFor(equip: RoiEquip[], m: Pick<PlantMachine, "brand" | "model" | "kg">): number {
  const first = m.model.trim().split(/\s+/)[0]?.toLowerCase();
  if (!first) return -1;
  const rows = equip
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => {
      const nome = e.nome.toLowerCase();
      return isBrandRow(e.nome) && nome.startsWith(`${m.brand.toLowerCase()} `) && nome.includes(first);
    });
  if (rows.length === 0) return -1;
  return (rows.find(({ e }) => equipKg(e) === m.kg) ?? rows[0]).i;
}

/** Linha que cita o código do modelo ("Lavadora SYC180" → linha "SYC180 + ST055"). */
function codeRowFor(equip: RoiEquip[], m: Pick<PlantMachine, "model">): number {
  const codes = m.model.toUpperCase().match(/[A-Z]{2,}\d{2,}/g) ?? [];
  if (codes.length === 0) return -1;
  return equip.findIndex((e) => {
    const words = `${e.nome} ${e.modelo ?? ""}`.toUpperCase().split(/[^A-Z0-9]+/);
    return codes.some((c) => words.includes(c));
  });
}

/** Linha do ROI pra cada máquina: a do código do modelo, a da marca/modelo, senão a da mesma faixa de tamanho (ou a mais próxima). */
function equipIndexFor(equip: RoiEquip[], m: Pick<PlantMachine, "brand" | "model" | "kg">): number {
  const code = codeRowFor(equip, m);
  if (code >= 0) return code;
  const own = brandRowFor(equip, m);
  if (own >= 0) return own;
  const want = TIER_ORDER.indexOf(tierOf(m.kg));
  let best = 0;
  let bestDist = Infinity;
  equip.forEach((e, i) => {
    if (isBrandRow(e.nome)) return;
    const ek = equipKg(e);
    if (ek === null) return;
    const dist = Math.abs(TIER_ORDER.indexOf(tierOf(ek)) - want);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return best;
}

/** Quantidade de cada linha de equipamento do ROI pra ficar igual à planta. */
// Cada equipamento do ROI é lavagem + secagem: stack conta 1; lavadora e
// secadora avulsas formam pares (2 lavadoras + 2 secadoras = 2 equipamentos).
export function roiQtyFromPlant(equip: RoiEquip[], plant: PlantMachine[]): number[] {
  const stacks = equip.map(() => 0);
  const washers = equip.map(() => 0);
  const dryers = equip.map(() => 0);
  for (const m of plant) {
    const i = equipIndexFor(equip, m);
    if (m.type === "lavadora") washers[i] += m.qty;
    else if (m.type === "secadora") dryers[i] += m.qty;
    else stacks[i] += m.qty;
  }
  return stacks.map((s, i) => s + Math.max(washers[i], dryers[i]));
}

/** Bocas por faixa de tamanho pra Conectividade: cada boca na faixa do seu kg. */
export function fleetFromPlant(plant: PlantMachine[]): Record<TierId, number> {
  const fleet: Record<TierId, number> = { p: 0, m: 0, g: 0, x: 0 };
  for (const m of plant) for (const kg of m.bocasKg) fleet[tierOf(kg)] += m.qty;
  return fleet;
}

const kgLabel = (kg: number) => `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;

/** Quais máquinas da planta caem em cada faixa: "2× LG Titan Stack (lavadora 17 kg + secadora 13,6 kg)". */
export function fleetDetailFromPlant(plant: PlantMachine[]): Record<TierId, string[]> {
  const out: Record<TierId, string[]> = { p: [], m: [], g: [], x: [] };
  for (const m of plant) {
    const parts: Record<TierId, string[]> = { p: [], m: [], g: [], x: [] };
    m.bocasKg.forEach((kg, k) => {
      const what = m.type === "stack" ? (k === 0 ? "lavadora" : "secadora") : m.type;
      parts[tierOf(kg)].push(`${what} ${kgLabel(kg)}`);
    });
    for (const t of TIER_ORDER) if (parts[t].length) out[t].push(`${m.qty}× ${m.label} (${parts[t].join(" + ")})`);
  }
  return out;
}

const parseInt0 = (s: string) => {
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export function roiMatchesPlant(equip: RoiEquip[], plant: PlantMachine[]): boolean {
  const want = roiQtyFromPlant(equip, plant);
  return equip.every((e, i) => e.qtd === want[i]);
}

export function insightsMatchesPlant(fleet: Record<TierId, string>, plant: PlantMachine[]): boolean {
  const want = fleetFromPlant(plant);
  return TIER_ORDER.every((t) => parseInt0(fleet[t]) === want[t]);
}

export function applyPlantToRoi(plant: PlantMachine[]): void {
  const s = useRoiStore.getState();
  roiQtyFromPlant(s.equip, plant).forEach((qtd, i) => {
    if (s.equip[i].qtd !== qtd) useRoiStore.getState().setEquip(i, { qtd });
  });
}

export function applyPlantToInsights(plant: PlantMachine[]): void {
  const s = useInsightsStore.getState();
  const fleet = fleetFromPlant(plant);
  for (const t of TIER_ORDER) s.setFleet(t, String(fleet[t]));
  // Loja nova: considera que todas as bocas ainda precisam da placa.
  s.setField("needplaca", String(TIER_ORDER.reduce((a, t) => a + fleet[t], 0)));
}

/** Máquinas da planta, atualizadas quando a planta ou o catálogo mudam. */
export function usePlant(): PlantMachine[] {
  const selection = useProjectStore((s) => s.machines);
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  return useMemo(() => plantMachines(selection, catalog), [selection, catalog]);
}

// Última planta já aplicada (sobrevive ao recarregar: não refaz em cima das
// edições à mão se a planta não mudou).
const SYNC_KEY = "lavanderia.plantSync.v1";

function readSync(): { roi?: string; insights?: string } {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY) ?? "{}") as { roi?: string; insights?: string };
  } catch {
    return {};
  }
}

function writeSync(v: { roi?: string; insights?: string }): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(v));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

/** Faz ROI e Conectividade seguirem a planta sempre que ela muda. */
export function usePlantSync(): void {
  const plant = usePlant();
  const sig = plant.map((m) => `${m.label}:${m.qty}:${m.bocasKg.join("/")}`).join("|");
  useEffect(() => {
    const last = readSync();
    if (last.roi !== sig) applyPlantToRoi(plant);
    if (last.insights !== sig) applyPlantToInsights(plant);
    if (last.roi !== sig || last.insights !== sig) writeSync({ roi: sig, insights: sig });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}

/** Texto curto: "3× Speed Queen Stack 10". */
export function plantSummary(plant: PlantMachine[]): string {
  if (plant.length === 0) return "nenhuma máquina";
  return plant.map((m) => `${m.qty}× ${m.label}`).join(" + ");
}
