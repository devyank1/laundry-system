import { describe, expect, it } from "vitest";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, ProjectState } from "../engine/types";
import { LIGHTING_PRESETS, ceilingLightPositions } from "./lighting";

const catalog: CatalogMachine[] = [
  { id: "sq-stack", brand: "Speed Queen", model: "Stack", type: "stack", widthMm: 683, depthMm: 794, heightMm: 1986 },
];

const base: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 6000,
  orientation: "back",
  ceilingHeightMm: 2800,
  machines: [{ catalogId: "sq-stack", qty: 3 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  totemSide: "left",
  tableSide: "left",
  chairsSide: "left",
  acSide: "left",
  machineWall: "left",
  tableSlot: "farTop",
  chairsSlot: "near",
  acSlot: "near",
  counterSide: "right",
  counterSlot: "farBottom",
  acOverrideBTU: null,
};

describe("ceilingLightPositions", () => {
  it("espalha painéis em grade ~2m, todos dentro da sala", () => {
    const pos = ceilingLightPositions(computeLayout(base, catalog).layout!);
    expect(pos).toHaveLength(3 * 3); // 5m/2 = 2,5 → 3 colunas; 6m → 3 linhas
    for (const [x, z] of pos) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(5);
      expect(z).toBeGreaterThan(0);
      expect(z).toBeLessThan(6);
    }
  });

  it("sala grande não passa de 16 luzes", () => {
    const pos = ceilingLightPositions(
      computeLayout({ ...base, roomWidthMm: 12000, roomDepthMm: 20000 }, catalog).layout!
    );
    expect(pos.length).toBeLessThanOrEqual(16);
    expect(pos.length).toBeGreaterThan(4);
  });
});

describe("LIGHTING_PRESETS", () => {
  it("à noite a luz de fora cai e as luzes da loja sobem", () => {
    const { day, night } = LIGHTING_PRESETS;
    expect(night.ambient).toBeLessThan(day.ambient);
    expect(night.sun).toBeLessThan(day.sun);
    expect(night.panelLight).toBeGreaterThan(day.panelLight);
    expect(night.facadeSpot).toBeGreaterThan(day.facadeSpot);
  });
});
