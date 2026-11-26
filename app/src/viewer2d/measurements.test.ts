import { describe, expect, it } from "vitest";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, Layout, ProjectState } from "../engine/types";
import { machineChainStops, outsideChains, planMeasurements, sizeText } from "./measurements";
import { formatMeters } from "./planTheme";

const catalog: CatalogMachine[] = [
  { id: "sq-stack", brand: "Speed Queen", model: "Stack", type: "stack", widthMm: 683, depthMm: 794, heightMm: 1986 },
];

// Loja de referência do dono: 5 × 6 (30 m²), máquinas no fundo.
const base: ProjectState = {
  roomWidthMm: 5000, roomDepthMm: 6000, orientation: "back", ceilingHeightMm: 2800,
  machines: [{ catalogId: "sq-stack", qty: 3 }], doorEnabled: true, techAccessSide: "right", furnitureEnabled: true,
  totemSide: "left", tableSide: "left", chairsSide: "left", acSide: "left", machineWall: "left",
  tableSlot: "farTop", chairsSlot: "farTop", acSlot: "farBottom", counterSide: "right", counterSlot: "farBottom", acOverrideBTU: null,
};

function layoutOf(patch: Partial<ProjectState> = {}): Layout {
  const { layout } = computeLayout({ ...base, ...patch }, catalog);
  if (!layout) throw new Error("sem layout");
  return layout;
}
const chain = (l: Layout, side: string) => outsideChains(l).find((c) => c.side === side);

describe("outsideChains (por fora da loja)", () => {
  it("fundo: esquerda com fundo + espaço livre até a fachada; em cima a largura", () => {
    const l = layoutOf();
    expect(chain(l, "left")?.stops).toEqual([0, l.drywall.y, 6000]);
    expect(chain(l, "top")?.stops).toEqual([0, 5000]);
  });

  it("frente: parede, porta e parede", () => {
    const l = layoutOf();
    const fd = l.frontDoor!;
    expect(chain(l, "bottom")?.stops).toEqual([0, fd.x, fd.x + fd.width, 5000]);
    expect(chain(layoutOf({ doorEnabled: false }), "bottom")).toBeUndefined();
  });

  it("lateral: em cima, fundo e salão", () => {
    const left = layoutOf({ orientation: "side", machineWall: "left", roomWidthMm: 5000, roomDepthMm: 9000 });
    expect(chain(left, "top")?.stops).toEqual([0, left.drywall.y, 5000]);
    const right = layoutOf({ orientation: "side", machineWall: "right", roomWidthMm: 5000, roomDepthMm: 9000 });
    expect(chain(right, "top")?.stops).toEqual([0, 5000 - right.drywall.y, 5000]);
    expect(chain(right, "left")).toBeUndefined();
  });
});

describe("machineChainStops (junto das máquinas)", () => {
  it("máquinas e o vão até a porta técnica", () => {
    const l = layoutOf();
    const stops = machineChainStops(l);
    const td = l.techDoor;
    expect(stops).toContain(td.x);
    expect(stops).toContain(Math.round(td.x + td.width));
    const lastMachineEnd = Math.max(...l.machines.map((m) => Math.round(m.x + m.widthMm)));
    expect(stops).toContain(lastMachineEnd);
    expect(stops).toEqual([...stops].sort((a, b) => a - b));
  });

  it("lateral: vai até a fachada (espaço livre depois da fileira)", () => {
    const l = layoutOf({ orientation: "side", roomWidthMm: 5000, roomDepthMm: 9000 });
    expect(machineChainStops(l).at(-1)).toBe(9000);
  });
});

describe("totais e distâncias novas", () => {
  it("total das máquinas na frente delas", () => {
    const l = layoutOf();
    const total = planMeasurements(l).find((m) => m.id === "maquinas-total")!;
    const start = Math.min(...l.machines.map((m) => m.x));
    const end = Math.max(...l.machines.map((m) => m.x + m.widthMm));
    expect(total.text).toBe(formatMeters(end - start));
    expect(total.y0).toBeGreaterThan(l.drywall.y); // do lado do salão
  });

  it("mesa central até as máquinas", () => {
    const l = layoutOf();
    const t = l.furniture!.table!;
    const m = planMeasurements(l).find((x) => x.id === "mesa-maquinas")!;
    expect(m.text).toBe(formatMeters(t.y - l.drywall.y));
    expect(m.x0).toBeGreaterThanOrEqual(t.x);
    expect(m.x0).toBeLessThanOrEqual(t.x + t.width);
  });

  it("porta técnica (0,70) até o balcão", () => {
    const l = layoutOf();
    const td = l.techDoor;
    const furniture = { ...l.furniture!, premium: { counter: { x: 4250, y: 2940, width: 750, height: 2000 }, counterWall: "right" as const, pufs: null } };
    const m = planMeasurements({ ...l, furniture }).find((x) => x.id === "porta-balcao")!;
    expect(m.text).toBe(formatMeters(2940 - l.drywall.y));
    expect(m.x0).toBe(m.x1);
    expect(m.y0).toBe(l.drywall.y);
    expect(m.x0).toBeGreaterThanOrEqual(Math.max(td.x, 4250));
    expect(m.x0).toBeLessThanOrEqual(td.x + td.width);
  });

  it("lateral: porta técnica até o balcão na horizontal", () => {
    const l = layoutOf({ orientation: "side", roomWidthMm: 5000, roomDepthMm: 9000 });
    const furniture = { ...l.furniture!, premium: { counter: { x: 3000, y: 7000, width: 2000, height: 750 }, counterWall: "right" as const, pufs: null } };
    const m = planMeasurements({ ...l, furniture }).find((x) => x.id === "porta-balcao")!;
    expect(m.y0).toBe(m.y1);
    expect(m.text).toBe(formatMeters(3000 - l.drywall.y));
  });
  it("lateral: total e mesa até as máquinas na horizontal", () => {
    const l = layoutOf({ orientation: "side", roomWidthMm: 5000, roomDepthMm: 9000 });
    const ms = planMeasurements(l);
    expect(ms.find((m) => m.id === "maquinas-total")?.x0).toBe(ms.find((m) => m.id === "maquinas-total")?.x1);
    const mesa = ms.find((m) => m.id === "mesa-maquinas");
    if (mesa) expect(mesa.y0).toBe(mesa.y1);
  });
});

describe("sizeText", () => {
  it("maior × menor", () => {
    expect(sizeText({ x: 0, y: 0, width: 800, height: 2000 })).toBe("2,00 × 0,80");
  });
});

describe("planMeasurements (dentro da loja)", () => {
  it("só distâncias dos móveis até a fachada", () => {
    const l = layoutOf();
    const poufs = [{ x: 100, y: 3000, width: 500, height: 500 }];
    const ms = planMeasurements({ ...l, furniture: { ...l.furniture!, poufs } });
    expect(ms.find((m) => m.id === "cadeiras-fachada")?.text).toBe(formatMeters(6000 - 3500));
    expect(ms.some((m) => m.id === "cadeiras-fachada")).toBe(true);
  });

  it("balcão encostado na fachada não ganha distância", () => {
    const l = layoutOf();
    const furniture = { ...l.furniture!, premium: { counter: { x: 4000, y: 4000, width: 750, height: 2000 }, counterWall: "right" as const, pufs: null } };
    expect(planMeasurements({ ...l, furniture }).some((m) => m.id === "balcao-fachada")).toBe(false);
  });

  it("loja sem máquinas não quebra", () => {
    const l = layoutOf();
    expect(() => planMeasurements({ ...l, machines: [] })).not.toThrow();
    expect(() => machineChainStops({ ...l, machines: [] })).not.toThrow();
  });
});
