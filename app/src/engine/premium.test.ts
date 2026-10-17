import { describe, expect, it } from "vitest";
import { computeLayout, isPremium } from "./layout";
import type { CatalogMachine, ProjectState, Rect } from "./types";
import { COUNTER_DEPTH_MM, COUNTER_WIDTH_MM, PUFS_SIZE_MM } from "./constants";

const catalog: CatalogMachine[] = [
  { id: "sq-stack", brand: "Speed Queen", model: "Stack", type: "stack", widthMm: 683, depthMm: 794, heightMm: 1986 },
];

const base: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 6000, // 30 m²
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
  chairsSlot: "farTop",
  acSlot: "farBottom",
  counterSide: "right",
  counterSlot: "farBottom",
  acOverrideBTU: null,
};

const hit = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const layoutFor = (patch: Partial<ProjectState> = {}) =>
  computeLayout({ ...base, ...patch }, catalog).layout!;

describe("lavanderia premium (>= 30 m²)", () => {
  it("só é premium a partir de 30 m² de área total", () => {
    expect(isPremium({ ...base, roomWidthMm: 5000, roomDepthMm: 6000 })).toBe(true);
    expect(isPremium({ ...base, roomWidthMm: 5000, roomDepthMm: 5990 })).toBe(false);
    expect(isPremium({ ...base, roomWidthMm: 6000, roomDepthMm: 6000 })).toBe(true);
  });

  it("tem balcão em 30 m² e não tem em 29,9 m²", () => {
    expect(layoutFor().furniture?.premium).not.toBeNull();
    expect(layoutFor({ roomDepthMm: 5980 }).furniture?.premium).toBeNull();
  });

  it("sem mobiliário não tem balcão", () => {
    expect(layoutFor({ furnitureEnabled: false }).furniture).toBeNull();
  });

  describe.each([
    ["fileira no fundo", {}],
    ["fileira lateral esquerda", { orientation: "side" as const, machineWall: "left" as const }],
    ["fileira lateral direita", { orientation: "side" as const, machineWall: "right" as const }],
  ])("%s", (_name, patch) => {
    it.each(["farTop", "farBottom", "near"] as const)("balcão (encaixe %s) cabe, sem colidir", (slot) => {
      const layout = layoutFor({ ...patch, counterSlot: slot, counterSide: slot === "near" ? "left" : "right" });
      const f = layout.furniture!;
      const counter = f.premium!.counter!;
      expect(Math.min(counter.width, counter.height)).toBe(COUNTER_DEPTH_MM);
      expect(Math.max(counter.width, counter.height)).toBe(COUNTER_WIDTH_MM);
      expect(counter.x).toBeGreaterThanOrEqual(0);
      expect(counter.y).toBeGreaterThanOrEqual(0);
      expect(counter.x + counter.width).toBeLessThanOrEqual(layout.roomWidthMm);
      expect(counter.y + counter.height).toBeLessThanOrEqual(layout.roomDepthMm);
      for (const o of [f.table, ...f.poufs, f.totem, layout.techCorridor]) {
        expect(hit(counter, o)).toBe(false);
      }
      expect(hit(counter, f.premium!.pufs!)).toBe(false);
    });
  });

  it("troca de lado com counterSide (fileira no fundo)", () => {
    const left = layoutFor({ counterSide: "left", tableSide: "right", chairsSide: "right" }).furniture!.premium!;
    const right = layoutFor({ counterSide: "right", tableSide: "left", chairsSide: "left" }).furniture!.premium!;
    expect(left.counterWall).toBe("left");
    expect(left.counter!.x).toBe(0);
    expect(right.counterWall).toBe("right");
    expect(right.counter!.x + right.counter!.width).toBe(5000);
  });

  it("troca de lado com counterSlot (fileira lateral)", () => {
    const side = { orientation: "side" as const, machineWall: "left" as const };
    const top = layoutFor({ ...side, counterSlot: "farTop", tableSlot: "farBottom", chairsSlot: "farBottom" }).furniture!.premium!;
    const bottom = layoutFor({ ...side, counterSlot: "farBottom", tableSlot: "farTop", chairsSlot: "farTop" }).furniture!.premium!;
    expect(top.counter!.y).toBeLessThan(bottom.counter!.y);
    expect(top.counterWall).toBe("right");
  });

  describe.each([
    ["fileira no fundo", {}],
    ["fileira lateral esquerda", { orientation: "side" as const, machineWall: "left" as const }],
    ["fileira lateral direita", { orientation: "side" as const, machineWall: "right" as const }],
  ])("pufs (%s)", (_name, patch) => {
    it("ficam perto do meio do salão e sem colidir", () => {
      const layout = layoutFor(patch);
      const f = layout.furniture!;
      const pufs = f.premium!.pufs!;
      expect(pufs.width).toBe(PUFS_SIZE_MM);
      expect(pufs.height).toBe(PUFS_SIZE_MM);
      for (const o of [f.table, ...f.poufs, f.totem, layout.techCorridor, f.premium!.counter!]) {
        expect(hit(pufs, o)).toBe(false);
      }
      // dentro da planta e, na fileira no fundo, perto do centro da loja
      expect(pufs.x).toBeGreaterThanOrEqual(0);
      expect(pufs.x + pufs.width).toBeLessThanOrEqual(layout.roomWidthMm);
      const cx = pufs.x + pufs.width / 2;
      if (layout.orientation === "back") {
        expect(Math.abs(cx - layout.roomWidthMm / 2)).toBeLessThan(1500);
      }
    });
  });

  it("pufs não existem abaixo de 30 m²", () => {
    expect(layoutFor({ roomDepthMm: 5980 }).furniture?.premium).toBeNull();
  });

  it("cai pro outro lado se o escolhido estiver ocupado, sem sumir", () => {
    // Mesa + cadeiras ocupam a esquerda, e o balcão pede a esquerda.
    const premium = layoutFor({ counterSide: "left" }).furniture!.premium;
    expect(premium).not.toBeNull();
  });
});
