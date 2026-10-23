import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
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

const plan = (s: Partial<ProjectState> = {}) => computeLayout({ ...state, ...s }, catalog).layout!.electricalPlan;

describe("computeElectricalPlan", () => {
  it("iluminação: 1a na área técnica, 1b no salão e 1c na marquise, fora da fachada", () => {
    const p = plan();
    const of = (k: string) => p.lighting.luminaires.filter((l) => l.kind === k);
    expect(of("1a").length).toBeGreaterThanOrEqual(2);
    expect(of("1b").length).toBeGreaterThanOrEqual(4);
    expect(of("1c").every((l) => l.y > state.roomDepthMm)).toBe(true);
    expect(p.lighting.runs.some((r) => r.kind === "perfilado")).toBe(true);
  });

  it("tomadas: um circuito 220 V por lavadora e um por secadora (stack = 2), ar e pressurizador", () => {
    const p = plan();
    const kinds = p.power.devices.map((d) => d.kind);
    expect(kinds.filter((k) => k === "tomada220")).toHaveLength(6); // lavadora + dosadoras por máquina
    expect(kinds.filter((k) => k === "steck")).toHaveLength(3);
    expect(kinds).toContain("ar");
    expect(kinds).toContain("pressurizador");
    expect(kinds.filter((k) => k === "tomada127baixa").length).toBeGreaterThan(0);
  });

  it("balcão: uma tomada 127 V por banqueta (3)", () => {
    const p = plan({ roomWidthMm: 6000, roomDepthMm: 8000 });
    const counterSockets = p.power.devices.filter((d) => d.kind === "tomada127media" && d.wall !== null);
    expect(counterSockets).toHaveLength(3);
  });

  it("circuitos: letras na iluminação, números nas tomadas, ids únicos", () => {
    const ids = plan().circuits.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("A");
    expect(ids).toContain("1");
  });

  it("QD-01 na parede lateral ao lado da porta técnica, dentro da área técnica e fora do giro da porta", () => {
    const l = computeLayout(state, catalog).layout!;
    const p = l.electricalPlan.panel;
    expect(p.face).toBe("side");
    // porta técnica do lado direito (techAccessSide): quadro na lateral direita
    expect(p.wall).toBe("right");
    expect(p.x + p.width).toBe(state.roomWidthMm);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y + p.height).toBeLessThanOrEqual(l.drywall.y - 50 - l.techDoor.width);
  });

  it("QD-01 acompanha a porta técnica nas outras orientações", () => {
    const left = computeLayout({ ...state, techAccessSide: "left" }, catalog).layout!.electricalPlan.panel;
    expect(left.wall).toBe("left");
    expect(left.x).toBe(0);
    const side = computeLayout({ ...state, orientation: "side", machineWall: "left" }, catalog).layout!;
    const sp = side.electricalPlan.panel;
    expect(["top", "bottom"]).toContain(sp.wall);
    expect(sp.x + sp.width).toBeLessThanOrEqual(side.drywall.y);
  });

  it("modem embaixo do QD-01, com tomada 127 V + ponto de rede", () => {
    const p = plan();
    const modem = p.power.devices.find((d) => d.kind === "modem")!;
    expect(modem).toBeDefined();
    expect(modem.y).toBeCloseTo(p.panel.y + p.panel.height / 2);
    expect(p.circuits.find((c) => c.id === modem.circuit)!.voltage).toBe(127);
  });

  it("sem mobiliário: sem ar, totem nem fita de LED", () => {
    const p = plan({ furnitureEnabled: false });
    expect(p.power.devices.some((d) => d.kind === "ar")).toBe(false);
    expect(p.lighting.ledStrip).toBeNull();
  });
});
