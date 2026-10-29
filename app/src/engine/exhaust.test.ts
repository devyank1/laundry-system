import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import {
  COLLECTOR_STATIONS_MM,
  MAX_LENGTH_SHARED_MM,
  MAX_LENGTH_SINGLE_MM,
  MIN_TERMINATION_CLEARANCE_MM,
} from "./exhaust";
import { CATALOG_SEED } from "../catalog/seed";
import type { ProjectState } from "./types";

const base: ProjectState = {
  roomWidthMm: 6000,
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

const exhaustFor = (patch: Partial<ProjectState> = {}) =>
  computeLayout({ ...base, ...patch }, CATALOG_SEED).layout!.exhaust!;

describe("exaustão das secadoras", () => {
  it("coletor cresce de diâmetro a cada secadora (Ebook Stack)", () => {
    for (const n of [1, 2, 3, 4]) {
      const ex = exhaustFor({ machines: [{ catalogId: "sq-stack", qty: n }], roomWidthMm: 8000 });
      expect(ex.branches).toHaveLength(n);
      expect(ex.outletDiameterMm).toBe(COLLECTOR_STATIONS_MM[n - 1]);
      const dias = ex.collector.map((s) => s.diameterMm);
      expect(dias).toEqual([...dias].sort((a, b) => a - b)); // só aumenta rumo à saída
    }
  });

  it("uma Speed Queen usa duto de 102 mm (4 pol); Smart 17 usa 150 mm", () => {
    expect(exhaustFor({ machines: [{ catalogId: "sq-stack", qty: 1 }] }).branches[0].diameterMm).toBe(102);
    const smart = exhaustFor({ machines: [{ catalogId: "mamute-smart17", qty: 1 }] });
    expect(smart.branches[0].diameterMm).toBe(150);
    expect(smart.outletDiameterMm).toBeGreaterThanOrEqual(150);
  });

  it("ramais entram no coletor a 45° em planta (nunca em T de 90°) e a favor do fluxo", () => {
    const ex = exhaustFor();
    for (const b of ex.branches) {
      const [, turn, join] = b.points;
      expect(Math.abs(join.a - turn.a)).toBeCloseTo(Math.abs(join.c - turn.c)); // 45°
      expect(join.c).toBeLessThan(turn.c); // indo pra parede do coletor
    }
  });

  it("sai pela parede de trás (c < 0), no lado oposto à porta técnica, com bocal pra baixo", () => {
    const right = exhaustFor({ techAccessSide: "right" });
    const left = exhaustFor({ techAccessSide: "left" });
    expect(right.exitSide).toBe("start");
    expect(left.exitSide).toBe("end");
    for (const ex of [right, left]) {
      const pts = ex.exit.points;
      expect(pts[pts.length - 1].c).toBeLessThan(0); // do lado de fora da parede
      expect(pts[pts.length - 1].y).toBeLessThan(pts[pts.length - 2].y); // desce
    }
    const w = 6000;
    expect(right.exit.points[1].a).toBeLessThan(w / 2);
    expect(left.exit.points[1].a).toBeGreaterThan(w / 2);
  });

  it("coletor passa atrás das máquinas e abaixo do teto", () => {
    const layout = computeLayout(base, CATALOG_SEED).layout!;
    const ex = layout.exhaust!;
    const y = ex.collector[0].points[0].y;
    expect(y + ex.outletDiameterMm / 2).toBeLessThanOrEqual(layout.ceilingHeightMm);
    expect(ex.collector[0].points[0].c).toBeGreaterThan(0);
    expect(ex.collector[0].points[0].c).toBeLessThan(layout.drywall.y - 794);
  });

  it("bocal fica a pelo menos 910 mm do piso", () => {
    expect(exhaustFor().terminationClearanceMm).toBeGreaterThanOrEqual(MIN_TERMINATION_CLEARANCE_MM);
  });

  it("limite de comprimento: 9,1 m compartilhado, 4,3 m instalação simples", () => {
    expect(exhaustFor().maxLengthMm).toBe(MAX_LENGTH_SHARED_MM);
    expect(exhaustFor({ machines: [{ catalogId: "sq-stack", qty: 1 }] }).maxLengthMm).toBe(MAX_LENGTH_SINGLE_MM);
    expect(exhaustFor().withinLimit).toBe(true);
  });

  it.each([
    ["fileira lateral esquerda", { orientation: "side" as const, machineWall: "left" as const, roomWidthMm: 6000, roomDepthMm: 7000 }],
    ["fileira lateral direita", { orientation: "side" as const, machineWall: "right" as const, roomWidthMm: 6000, roomDepthMm: 7000 }],
  ])("%s: mesma rota, no referencial da fileira", (_n, patch) => {
    const ex = exhaustFor(patch);
    expect(ex.branches).toHaveLength(3);
    expect(ex.exit.points[2].c).toBeLessThan(0);
  });

  it("loja sem secadoras não tem exaustão", () => {
    const layout = computeLayout(
      { ...base, machines: [{ catalogId: "lav", qty: 2 }] },
      [{ id: "lav", brand: "x", model: "y", type: "lavadora", widthMm: 600, depthMm: 700, heightMm: 900 }]
    ).layout!;
    expect(layout.exhaust).toBeNull();
  });
});

describe("ST055 (resumo de instalação, pasta maq)", () => {
  const st = () => exhaustFor({ machines: [{ catalogId: "sq-st055", qty: 1 }], ceilingHeightMm: 3000, roomWidthMm: 7000 });

  it("saída traseira Ø200 a 145 mm da base (nicho a 8 cm), subindo reto antes do 45°", () => {
    const b = st().branches[0];
    expect(b.diameterMm).toBe(200);
    expect(b.points[0].y).toBe(80 + 145);
    expect(b.points.length).toBe(4);
    const [, turn, rise, join] = b.points;
    expect(rise.c).toBe(turn.c);
    expect(rise.y).toBeGreaterThan(turn.y);
    expect(Math.abs(join.a - rise.a)).toBeCloseTo(Math.abs(join.c - rise.c)); // 45°
  });

  it("bocal virado pra baixo a ≥ 91 cm do piso e duto +2\" a cada 3,5 m", () => {
    const ex = st();
    expect(ex.terminationClearanceMm).toBeGreaterThanOrEqual(MIN_TERMINATION_CLEARANCE_MM);
    expect(ex.outletDiameterMm).toBeGreaterThanOrEqual(200);
    expect((ex.outletDiameterMm - 200) % 51).toBeLessThanOrEqual(1);
  });
});
