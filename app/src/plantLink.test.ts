import { describe, expect, it } from "vitest";
import { CATALOG_SEED } from "./catalog/seed";
import { defaultRoiState } from "./roi/model";
import {
  fleetFromPlant,
  insightsMatchesPlant,
  machineKg,
  plantMachines,
  roiMatchesPlant,
  roiQtyFromPlant,
  tierOf,
} from "./plantLink";

const equip = defaultRoiState().equip;

describe("plantLink", () => {
  it("lê a capacidade do catálogo ou do nome do modelo", () => {
    expect(machineKg(CATALOG_SEED[0])).toBe(10);
    expect(machineKg({ ...CATALOG_SEED[2], capacityKg: undefined })).toBe(17);
    expect(machineKg({ ...CATALOG_SEED[0], capacityKg: undefined, model: "Sem número" })).toBe(10);
  });

  it("faixas de tamanho iguais às da Conectividade", () => {
    expect([10, 12, 13, 17, 18, 20, 23, 30].map(tierOf)).toEqual(["p", "p", "m", "m", "m", "g", "g", "x"]);
  });

  it("3 Speed Queen na planta = 3 chassis pequenos no ROI", () => {
    const plant = plantMachines([{ catalogId: "sq-stack", qty: 3 }], CATALOG_SEED);
    expect(roiQtyFromPlant(equip, plant)).toEqual([3, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("LG Giant C e Titan vão pras linhas LG do ROI", () => {
    const plant = plantMachines(
      [
        { catalogId: "lg-giant-c", qty: 2 },
        { catalogId: "lg-titan", qty: 3 },
      ],
      CATALOG_SEED,
    );
    expect(roiQtyFromPlant(equip, plant)).toEqual([0, 0, 0, 0, 2, 3, 0, 0]);
    expect(fleetFromPlant(plant)).toEqual({ p: 4, m: 6, g: 0, x: 0 });
  });

  it("SYC180 + ST055 avulsas formam pares na linha delas (1 equipamento = lavagem + secagem)", () => {
    const plant = plantMachines(
      [
        { catalogId: "sq-syc180", qty: 2 },
        { catalogId: "sq-st055", qty: 2 },
      ],
      CATALOG_SEED,
    );
    expect(roiQtyFromPlant(equip, plant)).toEqual([0, 0, 0, 2, 0, 0, 0, 0]);
    // 1 boca cada: lavadora 20 kg (faixa g), secadora 25 kg (faixa x)
    expect(fleetFromPlant(plant)).toEqual({ p: 0, m: 0, g: 2, x: 2 });
  });

  it("5 máquinas misturadas: cada uma na linha da sua faixa", () => {
    const plant = plantMachines(
      [
        { catalogId: "sq-stack", qty: 2 },
        { catalogId: "mamute-smart10", qty: 1 },
        { catalogId: "mamute-smart17", qty: 2 },
      ],
      CATALOG_SEED,
    );
    // Mamute vai pras linhas Mamute (Smart 10 e Smart 17), Speed Queen pelo tamanho
    expect(roiQtyFromPlant(equip, plant)).toEqual([2, 0, 0, 0, 0, 0, 1, 2]);
    // stack = lavadora + secadora: 2 bocas por máquina
    expect(fleetFromPlant(plant)).toEqual({ p: 6, m: 4, g: 0, x: 0 });
  });

  it("ignora máquinas com quantidade 0 ou fora do catálogo", () => {
    const plant = plantMachines(
      [
        { catalogId: "sq-stack", qty: 0 },
        { catalogId: "nao-existe", qty: 4 },
      ],
      CATALOG_SEED,
    );
    expect(plant).toEqual([]);
    expect(roiQtyFromPlant(equip, plant)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("diz se o cálculo está igual à planta", () => {
    const plant = plantMachines([{ catalogId: "sq-stack", qty: 3 }], CATALOG_SEED);
    expect(roiMatchesPlant(equip, plant)).toBe(false); // padrão do ROI: 3 + 2
    const synced = equip.map((e, i) => ({ ...e, qtd: i === 0 ? 3 : 0 }));
    expect(roiMatchesPlant(synced, plant)).toBe(true);
    expect(insightsMatchesPlant({ p: "6", m: "0", g: "0", x: "0" }, plant)).toBe(true);
    expect(insightsMatchesPlant({ p: "4", m: "2", g: "0", x: "0" }, plant)).toBe(false);
  });
});
