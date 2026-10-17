import { describe, expect, it } from "vitest";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, ProjectState } from "../engine/types";
import { facadeDims } from "./facade";
import { drywallFrame } from "./placement";
import { ENTRANCE_RUG, MACHINE_RUG_DEPTH, placeStoreFixtures } from "./rugs";

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
  chairsSlot: "farTop",
  acSlot: "farBottom",
  counterSide: "right",
  counterSlot: "farBottom",
  acOverrideBTU: null,
};

const layoutFor = (patch: Partial<ProjectState> = {}) => computeLayout({ ...base, ...patch }, catalog).layout!;

describe.each([
  ["fileira no fundo", {}],
  ["fileira lateral esquerda", { orientation: "side" as const, machineWall: "left" as const }],
  ["fileira lateral direita", { orientation: "side" as const, machineWall: "right" as const }],
])("placeStoreFixtures (%s)", (_name, patch) => {
  const layout = layoutFor(patch);
  const fx = placeStoreFixtures(layout);

  it("tapete da entrada tem tamanho de tapete e fica logo depois da porta, centrado nela", () => {
    const f = facadeDims(layout);
    expect(fx.entranceRug.width).toBe(ENTRANCE_RUG.width);
    expect(fx.entranceRug.depth).toBe(ENTRANCE_RUG.depth);
    expect(fx.entranceRug.x).toBeCloseTo((f.door.x0 + f.door.x1) / 2);
    expect(fx.entranceRug.z + fx.entranceRug.depth / 2).toBeLessThan(f.glassZ); // dentro da loja
  });

  it("tapete das máquinas vai da primeira à última máquina", () => {
    const frame = drywallFrame(layout);
    const spans = layout.drywall.openings.map(frame.markerSpan);
    const first = Math.min(...spans.map((s) => s.start));
    const last = Math.max(...spans.map((s) => s.end));
    expect(fx.machineRug).not.toBeNull();
    expect(fx.machineRug!.width).toBeCloseTo(last - first);
    expect(fx.machineRug!.depth).toBe(MACHINE_RUG_DEPTH);
    // centro dele = centro da fileira (ao longo da parede)
    const along = layout.orientation === "side" ? fx.machineRug!.z : fx.machineRug!.x;
    expect(along).toBeCloseTo((first + last) / 2);
  });

  it("lixeira fica no chão, junto dos dispensers (um pouco pra dentro do salão)", () => {
    const spot = placeStoreFixtures(layout).dispensers!;
    expect(fx.trash).not.toBeNull();
    expect(Math.hypot(fx.trash!.x - spot.x, fx.trash!.z - spot.z)).toBeCloseTo(0.2);
  });
});

describe("mais máquinas = tapete maior", () => {
  it("a largura acompanha a fileira", () => {
    const small = placeStoreFixtures(layoutFor({ machines: [{ catalogId: "sq-stack", qty: 2 }] }));
    const big = placeStoreFixtures(layoutFor({ machines: [{ catalogId: "sq-stack", qty: 4 }], roomWidthMm: 6500 }));
    expect(big.machineRug!.width).toBeGreaterThan(small.machineRug!.width);
  });
});

describe.each([
  ["totem à esquerda", { totemSide: "left" as const, techAccessSide: "right" as const }],
  ["totem à direita", { totemSide: "right" as const, techAccessSide: "left" as const }],
  ["totem junto da porta técnica", { totemSide: "right" as const, techAccessSide: "right" as const }],
])("dispensers (%s)", (_name, patch) => {
  it.each([["fundo", {}], ["lateral", { orientation: "side" as const }]])(
    "ficam no drywall, no lado das máquinas oposto ao totem (%s)",
    (_o, extra) => {
      const layout = layoutFor({ ...patch, ...extra });
      const d = placeStoreFixtures(layout).dispensers;
      expect(d).not.toBeNull();
      const frame = drywallFrame(layout);
      // along do dispenser: inverte pos(along, 0, 0) a partir do mundo
      const along = layout.orientation === "side" ? d!.z : d!.x;
      const spans = layout.drywall.openings.map(frame.markerSpan);
      const rowMid = (Math.min(...spans.map((s) => s.start)) + Math.max(...spans.map((s) => s.end))) / 2;
      const totem = frame.spatialSpan(layout.furniture!.totem);
      const totemLow = (totem.start + totem.end) / 2 < rowMid;
      expect(along < rowMid).toBe(!totemLow);
      // fora das máquinas
      for (const s of spans) expect(along < s.start || along > s.end).toBe(true);
    }
  );
});

