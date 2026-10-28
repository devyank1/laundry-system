import type { CatalogMachine } from "../engine/types";

export const CATALOG_SEED: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack Elétrica (SSU/SSG)",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
    breakerLavadoraA: 16,
    breakerSecadoraA: 32,
    cableMm2: "6mm² (≤4,5m) / 10mm² (>4,5m)",
    exhaustDiameterMm: 102, // 4" (Ebook Stack)
    exhaustHeightMm: 1695, // saída traseira, dimensão B do manual SSU/SSG
    drainLpm: 14,
    capacityKg: 10,
  },
  {
    id: "mamute-smart10",
    brand: "Mamute",
    model: "Smart 10",
    type: "stack",
    widthMm: 680,
    depthMm: 880,
    heightMm: 2040,
    breakerLavadoraA: 16,
    breakerSecadoraA: 40,
    cableMm2: "2x2,5mm² (lavadora) / 2x10mm² (secadora)",
    exhaustDiameterMm: 100,
    drainInch: '2"',
    weightKg: 250,
    capacityKg: 10,
  },
  {
    id: "mamute-smart17",
    brand: "Mamute",
    model: "Smart 17",
    type: "stack",
    widthMm: 835,
    depthMm: 1190,
    heightMm: 2210,
    exhaustDiameterMm: 150,
    drainInch: '3"',
    weightKg: 615,
    capacityKg: 17,
  },
];
