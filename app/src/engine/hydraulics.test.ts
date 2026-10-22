import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import {
  DRAIN_BASE_DIAMETER_MM,
  STANDPIPE_DIAMETER_MM,
  STANDPIPE_HEIGHT_MM,
  DOSING_JUG_HEIGHT_MM,
  WATER_ELBOW_MM,
  DOSING_PUMP_Y_MM,
  DRAIN_LINE_Y_MM,
  FLOOR_DRAIN_SIZE_MM,
  drainDiameterMmAt,
  waterMainDiameterMm,
} from "./hydraulics";
import { CATALOG_SEED } from "../catalog/seed";
import type { ProjectState } from "./types";

const base: ProjectState = {
  roomWidthMm: 7000,
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

const hydFor = (patch: Partial<ProjectState> = {}) =>
  computeLayout({ ...base, ...patch }, CATALOG_SEED).layout!.hydraulics!;

describe("hidráulica e esgoto das lavadoras", () => {
  it("tubo de esgoto cresce 25% do diâmetro A (3 pol) a cada máquina (SSU/SSG)", () => {
    expect(drainDiameterMmAt(1)).toBeCloseTo(DRAIN_BASE_DIAMETER_MM);
    expect(drainDiameterMmAt(2)).toBeCloseTo(DRAIN_BASE_DIAMETER_MM * 1.25);
    expect(drainDiameterMmAt(3)).toBeCloseTo(DRAIN_BASE_DIAMETER_MM * 1.5);
    const h = hydFor();
    const dias = h.drainLine.map((s) => s.diameterMm);
    expect(dias).toEqual([...dias].sort((a, b) => a - b));
    expect(h.summary.drainDiameterMm).toBeCloseTo(DRAIN_BASE_DIAMETER_MM * 1.5, 0);
  });

  it("uma lavadora: canal de 3 pol e vazão de 14 L/min; cada máquina soma 14", () => {
    const one = hydFor({ machines: [{ catalogId: "sq-stack", qty: 1 }] });
    expect(one.summary.drainDiameterMm).toBeCloseTo(76.2, 0);
    expect(one.summary.drainFlowLpm).toBe(14);
    expect(hydFor().summary.drainFlowLpm).toBe(42);
  });

  it("água sobe do chão até a altura dos galões (registro no meio), T com cotovelo de 90° em cada ponta", () => {
    const layout = computeLayout(base, CATALOG_SEED).layout!;
    const h = layout.hydraulics!;
    expect(h.washers).toHaveLength(3);
    // barramento corre no piso
    for (const p of h.manifold.points) expect(p.y - h.manifold.diameterMm / 2).toBeGreaterThanOrEqual(0);
    for (const p of h.manifold.points) expect(p.y).toBeLessThan(60);
    for (const w of h.washers) {
      expect(w.waterPointHeightMm).toBe(DOSING_JUG_HEIGHT_MM);
      const [bottom, top] = w.water.riser;
      expect(bottom.y).toBe(h.manifold.points[0].y); // nasce no barramento do piso
      expect(top.y).toBe(DOSING_JUG_HEIGHT_MM); // até a altura dos galões
      expect(bottom.a).toBe(top.a);
      expect(bottom.c).toBe(top.c);
      // registro no meio do tubo
      expect(Math.abs(w.water.valve.y - (bottom.y + top.y) / 2)).toBeLessThanOrEqual(1);
      expect(w.water.valve.a).toBe(top.a);
      // T: dois braços na altura do topo, um pra cada lado
      expect(w.water.tee).toHaveLength(2);
      for (const t of w.water.tee) expect(t.y).toBe(top.y);
      expect(w.water.tee[0].a).toBeLessThan(top.a);
      expect(w.water.tee[1].a).toBeGreaterThan(top.a);
      // cotovelo de 90° em cada ponta, virado pra máquina (+c), na mesma altura
      const m = layout.machines.find((mm) => Math.abs(mm.x + mm.widthMm / 2 - w.a) < 1)!;
      w.water.elbows.forEach((e, k) => {
        const t = w.water.tee[k];
        expect(e.a).toBe(t.a);
        expect(e.y).toBe(t.y);
        expect(e.c - t.c).toBe(WATER_ELBOW_MM);
      });
      // entradas lado a lado na traseira, lá em cima, logo abaixo das bombas dosadoras
      const [i0, i1] = w.water.inlets;
      expect(i0.c).toBe(m.y);
      expect(i1.c).toBe(m.y);
      expect(i0.y).toBe(i1.y);
      const pumpBottom = DOSING_PUMP_Y_MM - 95;
      expect(i0.y).toBeLessThan(pumpBottom);
      expect(pumpBottom - i0.y).toBeLessThanOrEqual(150);
      expect(i1.a - i0.a).toBeGreaterThan(0);
      expect(i1.a - i0.a).toBeLessThanOrEqual(80);
      // mangueira: começa no cotovelo, lá embaixo, e termina na entrada
      w.water.hoses.forEach((hose, k) => {
        expect(hose[0]).toEqual(w.water.elbows[k]);
        expect(hose[hose.length - 1]).toEqual(w.water.inlets[k]);
        for (const p of hose) expect(p.c).toBeLessThanOrEqual(m.y); // nunca entra na máquina
      });
    }
  });

  it("tubo de água que sobe não cruza o tubo de esgoto suspenso", () => {
    for (const machines of [
      [{ catalogId: "sq-stack", qty: 3 }],
      [{ catalogId: "sq-stack", qty: 2 }, { catalogId: "mamute-smart17", qty: 1 }],
    ]) {
      const h = hydFor({ machines });
      const drain = h.drainLine[0].points[0].c;
      const maxR = Math.max(...h.drainLine.map((s) => s.diameterMm / 2));
      for (const w of h.washers) {
        expect(w.water.riser[0].c + 25 / 2).toBeLessThan(drain - maxR);
      }
    }
  });

  it("tubo vertical do dreno: 4-5 cm, 70 cm de altura, ligado ao tubo suspenso (abaixo das saídas)", () => {
    const h = hydFor();
    for (const w of h.washers) {
      expect(w.standpipe.diameterMm).toBeGreaterThanOrEqual(40);
      expect(w.standpipe.diameterMm).toBeLessThanOrEqual(STANDPIPE_DIAMETER_MM + 0.01);
      expect(w.standpipe.topY).toBe(STANDPIPE_HEIGHT_MM);
      // a mangueira faz o laço entre 61 e 91 cm antes de descer pro tubo
      const loopY = Math.max(...w.hose.map((p) => p.y));
      expect(loopY).toBeGreaterThanOrEqual(610);
      expect(loopY).toBeLessThanOrEqual(915);
      expect(w.hose[0].y).toBeLessThan(w.standpipe.topY);
      expect(w.standpipe.baseY).toBe(DRAIN_LINE_Y_MM);
    }
    // tubo suspenso: acima do piso (sem ralo/canal) e abaixo da saída de dreno da máquina
    for (const seg of h.drainLine) {
      for (const p of seg.points) {
        expect(p.y).toBeGreaterThan(0);
        expect(p.y + seg.diameterMm / 2).toBeLessThanOrEqual(h.washers[0].hose[0].y);
      }
    }
  });

  it("esgoto suspenso: suportes a cada 800 mm ao longo do tubo, nenhum no piso", () => {
    const h = hydFor();
    expect(h.drainSupports.length).toBeGreaterThanOrEqual(h.drainLine.length);
    for (const sp of h.drainSupports) expect(sp.y).toBe(DRAIN_LINE_Y_MM);
  });

  it("tubo individual de esgoto é RETO: do tubo central baixo até a boca aberta a 70 cm (sem T)", () => {
    const h = hydFor();
    for (const w of h.washers) {
      expect(w.standpipe.baseY).toBe(DRAIN_LINE_Y_MM); // sai do tubo central, baixo
      expect(w.standpipe.topY).toBe(700); // boca a 70 cm
      // a mangueira desce reto pra dentro da boca do tubo
      const end = w.hose[w.hose.length - 1];
      const before = w.hose[w.hose.length - 2];
      expect(end.a).toBe(w.standpipe.a);
      expect(end.c).toBe(w.standpipe.c);
      expect(end.y).toBeLessThan(w.standpipe.topY);
      expect(before.a).toBe(end.a);
      expect(before.c).toBe(end.c);
    }
    // um único tubo central, mais baixo que todos os tês
    expect(new Set(h.drainLine.slice(0, -1).map((s) => s.points[0].c)).size).toBe(1);
  });

  it("bombas dosadoras ficam ACIMA da entrada de água da lavadora", () => {
    for (const w of hydFor().washers) {
      const waterY = w.water.riser[1].y;
      for (const p of w.dosing.pumps) expect(p.y - 100).toBeGreaterThan(waterY + 36); // base da bomba acima dos registros
    }
  });

  it("um par de bombas dosadoras e um par de galões POR lavadora, colados atrás dela", () => {
    const one = hydFor({ machines: [{ catalogId: "sq-stack", qty: 1 }] });
    expect(one.summary.dosingPumps).toBe(2);
    const h = hydFor();
    expect(h.summary.dosingPumps).toBe(6);
    const layout = computeLayout(base, CATALOG_SEED).layout!;
    for (const w of h.washers) {
      expect(w.dosing.pumps).toHaveLength(2);
      expect(w.dosing.jugs).toHaveLength(2);
      expect(w.dosing.jugs.map((j) => j.kind)).toEqual(["detergente", "amaciante"]);
      const m = layout.machines.find((mm) => Math.abs(mm.x + mm.widthMm / 2 - w.a) < 1)!;
      for (const pump of w.dosing.pumps) {
        expect(pump.y).toBe(DOSING_PUMP_Y_MM);
        expect(pump.c).toBe(m.y); // costas da bomba na traseira da máquina
        expect(Math.abs(pump.a - w.a)).toBeLessThan(m.widthMm / 2);
      }
      // galões no chão, atrás da máquina e abaixo das bombas
      for (const jug of w.dosing.jugs) expect(jug.c).toBeLessThan(m.y);
    }
  });

  it("sai pela parede de trás (c < 0), no lado oposto à porta técnica, junto da exaustão", () => {
    const layout = computeLayout(base, CATALOG_SEED).layout!;
    const h = layout.hydraulics!;
    expect(h.sewerExit.outside.c).toBeLessThan(0);
    expect(h.waterEntry.outside.c).toBeLessThan(0);
    // na mesma faixa lateral da saída da exaustão (esgoto no chão, exaustão no alto)
    expect(Math.abs(h.sewerExit.inside.a - layout.exhaust!.exit.points[0].a)).toBeLessThanOrEqual(150);
    const left = hydFor({ techAccessSide: "left" });
    expect(left.sewerExit.inside.a).toBeGreaterThan(7000 / 2);
  });

  it("barramento dimensionado pela vazão (40 L/min por lavadora, vel. 2,5 m/s)", () => {
    expect(waterMainDiameterMm(1)).toBe(25);
    expect(waterMainDiameterMm(3)).toBeGreaterThanOrEqual(40);
    expect(waterMainDiameterMm(6)).toBeGreaterThan(waterMainDiameterMm(3));
    expect(hydFor().summary.supplyFlowLpm).toBe(120);
  });

  it("pressurizador entre a entrada de água e o barramento; pressão 200-570 kPa", () => {
    const h = hydFor();
    expect(h.pump.model).toMatch(/Komeco TP825/);
    expect(h.pump.inlet.a).toBe(h.waterEntry.through.a);
    expect(h.summary.pressureKpa).toEqual({ min: 200, max: 570 });
  });

  it("galões no chão não encostam no barramento nem no tubo de esgoto", () => {
    for (const machines of [
      [{ catalogId: "sq-stack", qty: 3 }],
      [{ catalogId: "sq-stack", qty: 2 }, { catalogId: "mamute-smart17", qty: 1 }],
    ]) {
      const h = hydFor({ machines });
      const cMan = h.manifold.points[0].c;
      const drain = h.drainLine[0].points[0].c;
      const maxR = Math.max(...h.drainLine.map((s) => s.diameterMm / 2));
      for (const w of h.washers) {
        for (const jug of w.dosing.jugs) {
          expect(Math.abs(jug.c - cMan)).toBeGreaterThan(95 + h.manifold.diameterMm / 2);
          expect(Math.abs(jug.c - drain)).toBeGreaterThan(95 + maxR);
        }
      }
    }
  });

  it("ralinho pequeno no piso da área técnica, junto da parede de trás", () => {
    const h = hydFor();
    expect(h.floorDrain.sizeMm).toBe(FLOOR_DRAIN_SIZE_MM);
    expect(h.floorDrain.sizeMm).toBeLessThanOrEqual(150);
    expect(h.floorDrain.c).toBeGreaterThan(h.floorDrain.sizeMm / 2); // dentro, não na parede
    expect(h.floorDrain.c).toBeLessThan(h.manifold.points[0].c); // atrás das tubulações
  });

  it("tem pelo menos um respiro, subindo até perto do teto", () => {
    const h = hydFor();
    expect(h.vents.length).toBeGreaterThanOrEqual(1);
    expect(h.vents[0].topY).toBeLessThan(2800);
  });

  it.each([
    ["fileira lateral esquerda", { orientation: "side" as const, machineWall: "left" as const, roomWidthMm: 6000, roomDepthMm: 7000 }],
    ["fileira lateral direita", { orientation: "side" as const, machineWall: "right" as const, roomWidthMm: 6000, roomDepthMm: 7000 }],
  ])("%s: mesma rota no referencial da fileira", (_n, patch) => {
    const h = hydFor(patch);
    expect(h.washers).toHaveLength(3);
    expect(h.sewerExit.outside.c).toBeLessThan(0);
  });

  it("sem lavadoras não há hidráulica", () => {
    const layout = computeLayout(
      { ...base, machines: [{ catalogId: "sec", qty: 2 }] },
      [{ id: "sec", brand: "x", model: "y", type: "secadora", widthMm: 700, depthMm: 800, heightMm: 1000 }]
    ).layout!;
    expect(layout.hydraulics).toBeNull();
  });
});
