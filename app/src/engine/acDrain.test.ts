import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import { AC_DRAIN_DIAMETER_MM } from "./acDrain";
import type { CatalogMachine, ProjectState } from "./types";

const catalog: CatalogMachine[] = [
  { id: "sq-stack", brand: "Speed Queen", model: "Stack", type: "stack", widthMm: 683, depthMm: 794, heightMm: 1986 },
];

const state: ProjectState = {
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
  acSide: "right",
  machineWall: "left",
  tableSlot: "farTop",
  chairsSlot: "farTop",
  acSlot: "farBottom",
  counterSide: "right",
  counterSlot: "farBottom",
  acOverrideBTU: null,
};

describe("dreno do ar-condicionado", () => {
  it("sai do aparelho, passa pelo corredor técnico e sai pela parede de trás", () => {
    const layout = computeLayout(state, catalog).layout!;
    const d = layout.acDrain!;
    const ac = layout.furniture!.ac;
    const [start] = d.points;
    // começa encostado no aparelho
    expect(start.x).toBeGreaterThanOrEqual(ac.x);
    expect(start.x).toBeLessThanOrEqual(ac.x + ac.width);
    expect(start.y).toBeGreaterThanOrEqual(ac.y);
    expect(start.y).toBeLessThanOrEqual(ac.y + ac.height);
    // atravessa o drywall pelo vão do corredor técnico
    const tc = layout.techCorridor;
    const atDrywall = d.points.find((p) => p.y === layout.drywall.y)!;
    expect(atDrywall.x).toBeGreaterThan(tc.x);
    expect(atDrywall.x).toBeLessThan(tc.x + tc.width);
    // termina do lado de fora da parede de trás (y < 0)
    expect(d.points[d.points.length - 1].y).toBeLessThan(0);
    expect(d.diameterMm).toBe(AC_DRAIN_DIAMETER_MM);
    expect(d.slopePct).toBe(2);
    expect(d.dropMm).toBe(Math.round(d.lengthMm * 0.02));
  });

  it("sem mobiliário (sem ar-condicionado) não tem dreno", () => {
    const layout = computeLayout({ ...state, furnitureEnabled: false }, catalog).layout!;
    expect(layout.acDrain).toBeNull();
  });

  it("orientação lateral: sai pela parede das máquinas", () => {
    for (const machineWall of ["left", "right"] as const) {
      const layout = computeLayout({ ...state, orientation: "side", machineWall }, catalog).layout!;
      const last = layout.acDrain!.points[layout.acDrain!.points.length - 1];
      if (machineWall === "left") expect(last.x).toBeLessThan(0);
      else expect(last.x).toBeGreaterThan(layout.roomWidthMm);
    }
  });
});
