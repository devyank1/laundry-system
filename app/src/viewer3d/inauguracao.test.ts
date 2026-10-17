import { describe, expect, it } from "vitest";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, Layout, ProjectState } from "../engine/types";
import { facadeDims } from "./facade";
import { placeInauguracao } from "./inauguracao";

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

const layoutFor = (patch: Partial<ProjectState> = {}): Layout =>
  computeLayout({ ...base, ...patch }, catalog).layout!;

describe.each([
  ["fileira no fundo", {}],
  ["fileira lateral esquerda", { orientation: "side" as const, machineWall: "left" as const }],
  ["fileira lateral direita", { orientation: "side" as const, machineWall: "right" as const }],
])("placeInauguracao (%s)", (_name, patch) => {
  const layout = layoutFor(patch);
  const p = placeInauguracao(layout);

  it("arco, carrinho e mesa de lembranças ficam na rua; a mesa à esquerda da porta", () => {
    const f = facadeDims(layout);
    expect(p.arch.z).toBeGreaterThan(f.frontZ);
    expect(p.cart.z).toBeGreaterThan(f.frontZ);
    expect(p.keepsakeTable.z).toBeGreaterThan(f.frontZ);
    expect(p.keepsakeTable.x).toBeLessThan(p.arch.x);
    expect(p.arch.x).toBeCloseTo((f.door.x0 + f.door.x1) / 2);
  });
});

describe("placeInauguracao em salão apertado", () => {
  it("omite os itens internos que não cabem, sem quebrar", () => {
    const p = placeInauguracao(layoutFor({ roomWidthMm: 3600, roomDepthMm: 4200 }));
    expect(p.arch).toBeDefined();
    expect(p.cart).toBeDefined();
    expect(p.keepsakeTable.z).toBeGreaterThan(0);
  });
});
