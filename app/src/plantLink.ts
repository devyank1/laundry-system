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
  qty: number;
  kg: number;
  /** bocas por máquina: stack = lavadora + secadora */
  bocas: number;
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
      return [{ label: `${m.brand} ${m.model}`, qty: s.qty, kg: machineKg(m), bocas: m.type === "stack" ? 2 : 1 }];
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

/** Maior capacidade escrita no nome do equipamento do ROI ("2 × 13,6 kg" → 13,6). */
function equipKg(nome: string): number | null {
  const all = [...nome.matchAll(/(\d+(?:,\d+)?)\s*kg/gi)].map((m) => parseFloat(m[1].replace(",", ".")));
  return all.length ? Math.max(...all) : null;
}

/** Linha do ROI pra cada máquina: a da mesma faixa de tamanho (ou a mais próxima). */
function equipIndexFor(equip: RoiEquip[], kg: number): number {
  const want = TIER_ORDER.indexOf(tierOf(kg));
  let best = 0;
  let bestDist = Infinity;
  equip.forEach((e, i) => {
    const ek = equipKg(e.nome);
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
export function roiQtyFromPlant(equip: RoiEquip[], plant: PlantMachine[]): number[] {
  const qty = equip.map(() => 0);
  for (const m of plant) qty[equipIndexFor(equip, m.kg)] += m.qty;
  return qty;
}

/** Bocas por faixa de tamanho pra Conectividade. */
export function fleetFromPlant(plant: PlantMachine[]): Record<TierId, number> {
  const fleet: Record<TierId, number> = { p: 0, m: 0, g: 0, x: 0 };
  for (const m of plant) fleet[tierOf(m.kg)] += m.qty * m.bocas;
  return fleet;
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
  const sig = plant.map((m) => `${m.label}:${m.qty}:${m.kg}:${m.bocas}`).join("|");
  useEffect(() => {
    const last = readSync();
    if (last.roi !== sig) applyPlantToRoi(plant);
    if (last.insights !== sig) applyPlantToInsights(plant);
    if (last.roi !== sig || last.insights !== sig) writeSync({ roi: sig, insights: sig });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}

/** Texto curto: "3× Speed Queen Stack Elétrica (SSU/SSG)". */
export function plantSummary(plant: PlantMachine[]): string {
  if (plant.length === 0) return "nenhuma máquina";
  return plant.map((m) => `${m.qty}× ${m.label}`).join(" + ");
}
