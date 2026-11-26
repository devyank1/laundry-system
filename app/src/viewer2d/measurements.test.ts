import { describe, expect, it } from "vitest";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, Layout, ProjectState } from "../engine/types";
import { planMeasurements, type MeasureId } from "./measurements";
import { formatMeters } from "./planTheme";

const catalog: CatalogMachine[] = [
  { id: "sq-stack", brand: "Speed Queen", model: "Stack", type: "stack", widthMm: 683, depthMm: 794, heightMm: 1986 },
];

const base: ProjectState = {
  roomWidthMm: 5000, roomDepthMm: 4200, orientation: "back", ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 2 }], doorEnabled: true, techAccessSide: "right", furnitureEnabled: true,
  totemSide: "left", tableSide: "left", chairsSide: "left", acSide: "left", machineWall: "left",
  tableSlot: "farTop", chairsSlot: "farTop", acSlot: "farBottom", counterSide: "right", counterSlot: "farBottom", acOverrideBTU: null,
};

function layoutOf(patch: Partial<ProjectState> = {}): Layout {
  const { layout } = computeLayout({ ...base, ...patch }, catalog);
  if (!layout) throw new Error("sem layout");
  return layout;
}
const byId = (l: Layout) => new Map(planMeasurements(l).map((m) => [m.id, m]));
const ids = (l: Layout) => planMeasurements(l).map((m) => m.id).sort();

describe("planMeasurements", () => {
  it("fundo da loja, espaço livre e porta", () => {
    const l = layoutOf();
    const m = byId(l);
    expect(m.get("fundo-largura")?.text).toBe("5,00");
    expect(m.get("fundo-comprimento")?.text).toBe(formatMeters(l.drywall.y));
    expect(m.get("livre-fachada")?.text).toBe(formatMeters(4200 - l.drywall.y));
    const fd = l.frontDoor!;
    const left = m.get("porta-esquerda")!;
    const right = m.get("porta-direita")!;
    expect(left.x1 - left.x0 + (right.x1 - right.x0) + fd.width).toBeCloseTo(5000);
    expect(left.text).toBe(formatMeters(fd.x));
  });

  it("mesa mostra largura × profundidade", () => {
    const l = layoutOf();
    expect(l.furniture?.table).toBeTruthy();
    expect(byId(l).get("mesa")?.text).toBe("2,00 × 0,80");
  });

  it("cotas horizontais ou verticais", () => {
    for (const m of planMeasurements(layoutOf())) expect(m.x0 === m.x1 || m.y0 === m.y1).toBe(true);
  });

  it("sem porta e sem móveis só sobram fundo e espaço livre", () => {
    expect(ids(layoutOf({ doorEnabled: false, furnitureEnabled: false }))).toEqual(
      (["fundo-comprimento", "fundo-largura", "livre-fachada"] as MeasureId[]).sort(),
    );
  });

  it("máquinas na lateral direita: fundo encostado na parede direita", () => {
    const l = layoutOf({ orientation: "side", machineWall: "right", roomWidthMm: 4200, roomDepthMm: 6000 });
    const m = byId(l);
    const w = m.get("fundo-largura")!;
    expect(Math.max(w.x0, w.x1)).toBe(4200);
    expect(w.text).toBe(formatMeters(l.drywall.y));
    expect(m.get("fundo-comprimento")?.text).toBe("6,00");
    const rowEnd = Math.max(...l.machines.map((mc) => mc.y + mc.depthMm));
    expect(m.get("livre-fachada")?.text).toBe(formatMeters(6000 - rowEnd));
  });

  it("balcão encostado na fachada não ganha distância; afastado ganha", () => {
    const l = layoutOf();
    const furniture = { ...l.furniture!, premium: { counter: { x: 2500, y: 3600, width: 2000, height: 600 }, counterWall: "bottom" as const, pufs: null } };
    const touching = byId({ ...l, furniture });
    expect(touching.get("balcao")?.text).toBe("2,00 × 0,60");
    expect(touching.has("balcao-fachada")).toBe(false);
    furniture.premium.counter = { x: 2500, y: 3000, width: 2000, height: 600 };
    expect(byId({ ...l, furniture }).get("balcao-fachada")?.text).toBe("0,60");
  });

  it("cadeiras: distância da mais próxima até a fachada", () => {
    const l = layoutOf();
    const poufs = [{ x: 100, y: 2000, width: 500, height: 500 }, { x: 700, y: 2600, width: 500, height: 500 }];
    const c = byId({ ...l, furniture: { ...l.furniture!, poufs } }).get("cadeiras-fachada")!;
    expect(c.text).toBe(formatMeters(4200 - 3100));
    expect(c.x0).toBe(950);
  });

  it("espaço livre não passa por cima de móvel nem da porta", () => {
    const l = layoutOf({ roomWidthMm: 6000, roomDepthMm: 7000 });
    const x = byId(l).get("livre-fachada")!.x0;
    const blockers = [l.furniture?.table, l.furniture?.premium?.counter, ...(l.furniture?.poufs ?? []), l.frontDoor].filter(Boolean);
    expect(blockers.length).toBeGreaterThan(2);
    for (const b of blockers) expect(x < b!.x || x > b!.x + b!.width).toBe(true);
  });

  it("loja sem máquinas não quebra", () => {
    const l = layoutOf();
    expect(() => planMeasurements({ ...l, machines: [] })).not.toThrow();
  });
});
