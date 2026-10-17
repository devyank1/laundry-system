import { describe, expect, it } from "vitest";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, ProjectState } from "../engine/types";
import { drywallFrame, fitSize, logoPlacement, wallYaw } from "./placement";

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

// Gira o vetor "frente nativa" (+z) por yaw em Y, como o three.js faz.
function front(yaw: number): [number, number] {
  return [Math.round(Math.sin(yaw)), Math.round(Math.cos(yaw))];
}

describe("wallYaw / fitSize", () => {
  it("vira a frente pra longe da parede em que o item encosta", () => {
    expect(front(wallYaw("left"))).toEqual([1, 0]); // olha pra +x
    expect(front(wallYaw("right"))).toEqual([-1, 0]);
    expect(front(wallYaw("top"))).toEqual([0, 1]); // olha pra +z (fachada)
    expect(front(wallYaw("bottom"))).toEqual([0, -1]);
  });

  it("troca x/z da caixa nativa só quando gira 90°", () => {
    expect(fitSize(0.8, 0.9, 2, Math.PI / 2)).toEqual([2, 0.9, 0.8]);
    expect(fitSize(0.8, 0.9, 2, -Math.PI / 2)).toEqual([2, 0.9, 0.8]);
    expect(fitSize(2, 0.9, 0.8, 0)).toEqual([2, 0.9, 0.8]);
    expect(fitSize(2, 0.9, 0.8, Math.PI)).toEqual([2, 0.9, 0.8]);
  });
});

describe("drywallFrame", () => {
  it("em 'back' o drywall é paralelo a x, máquinas olhando pra +z", () => {
    const layout = computeLayout(base, catalog).layout!;
    const f = drywallFrame(layout);
    expect(f.yaw).toBe(0);
    expect(f.alongLength).toBe(5);
    expect(f.pos(1, 0, 2)).toEqual([1, 0, 2]);
  });

  it("em 'side' esquerda o drywall é paralelo a z, máquinas olhando pra +x", () => {
    const layout = computeLayout({ ...base, orientation: "side" }, catalog).layout!;
    const f = drywallFrame(layout);
    expect(front(f.yaw)).toEqual([1, 0]);
    expect(f.alongLength).toBe(6);
    expect(f.pos(1, 0, 2)).toEqual([2, 0, 1]);
    expect(f.size(3, 2, 0.1)).toEqual([0.1, 2, 3]);
    // corredor técnico embaixo (techAccessSide="right"), 70cm
    const corridor = f.spatialSpan(layout.techCorridor);
    expect(corridor.start).toBeCloseTo(5.3);
    expect(corridor.end).toBeCloseTo(6);
    // vãos das máquinas começam a 50cm, ao longo de z
    expect(f.markerSpan(layout.drywall.openings[0]).start).toBeCloseTo(0.5);
  });

  it("em 'side' direita espelha: drywall perto de x=roomWidth, máquinas olhando pra -x", () => {
    const layout = computeLayout(
      { ...base, orientation: "side", machineWall: "right" },
      catalog
    ).layout!;
    const f = drywallFrame(layout);
    expect(front(f.yaw)).toEqual([-1, 0]);
    expect(f.pos(1, 0, 2)).toEqual([3, 0, 1]);
    // corredor espelhado continua no mesmo trecho do eixo along
    expect(f.spatialSpan(layout.techCorridor).start).toBeCloseTo(5.3);
  });
});

describe("paredes do mobiliário (pra virar no 3D)", () => {
  it("cadeiras/AC 'near' de costas pro drywall; 'far' de costas pra parede oposta", () => {
    const near = computeLayout({ ...base, orientation: "side" }, catalog).layout!.furniture!;
    expect(near.chairsWall).toBe("left");
    expect(near.acWall).toBe("left");

    const far = computeLayout(
      { ...base, orientation: "side", machineWall: "right", chairsSlot: "farTop", acSlot: "farBottom" },
      catalog
    ).layout!.furniture!;
    expect(far.chairsWall).toBe("left");
    expect(far.acWall).toBe("left");
  });

  it("sem drywall livre, cadeiras+AC 'near' encostam na parede de cima", () => {
    const f = computeLayout(
      { ...base, orientation: "side", machines: [{ catalogId: "sq-stack", qty: 6 }], tableSlot: "farBottom" },
      catalog
    ).layout!.furniture!;
    expect(f.chairsWall).toBe("top");
    expect(f.acWall).toBe("top");
  });

  it("em 'back' as cadeiras em coluna encostam na parede lateral escolhida", () => {
    const f = computeLayout({ ...base, chairsSide: "right", tableSide: "right" }, catalog).layout!
      .furniture!;
    expect(f.chairsWall).toBe("right");
  });
});

describe("logoPlacement", () => {
  it("centra a logo em cima da fileira, entre o topo da máquina e o teto", () => {
    const layout = computeLayout(base, catalog).layout!;
    const logo = logoPlacement(layout, 2)!; // logo 2:1
    // fileira: 0,50m até 0,50 + 3*0,683 + 2*0,02 = 2,589m
    expect(logo.position[0]).toBeCloseTo((0.5 + 2.589) / 2, 3);
    // vão de 1,986m (máquina) a 2,80m (teto): centro em 2,393m
    expect(logo.position[1]).toBeCloseTo((1.986 + 2.8) / 2, 3);
    // na frente do drywall (lado do salão)
    expect(logo.position[2]).toBeGreaterThan((1050 + 794 + 100) / 1000);
    // altura limitada pelo vão (0,814 - 2*0,08), proporção mantida
    expect(logo.height).toBeCloseTo(0.814 - 0.16, 3);
    expect(logo.width / logo.height).toBeCloseTo(2, 5);
    expect(logo.yaw).toBe(0);
  });

  it("logo muito larga é limitada a 90% do comprimento da fileira", () => {
    const layout = computeLayout(base, catalog).layout!;
    const logo = logoPlacement(layout, 10)!;
    expect(logo.width).toBeCloseTo(2.089 * 0.9, 3);
    expect(logo.width / logo.height).toBeCloseTo(10, 5);
  });

  it("em 'side' fica na parede lateral, virada pro salão", () => {
    const layout = computeLayout(
      { ...base, orientation: "side", machineWall: "right" },
      catalog
    ).layout!;
    const logo = logoPlacement(layout, 1)!;
    expect(front(logo.yaw)).toEqual([-1, 0]);
    expect(logo.position[2]).toBeCloseTo((0.5 + 2.589) / 2, 3); // ao longo de z
    expect(logo.position[0]).toBeLessThan(5 - (1050 + 794 + 100) / 1000);
  });

  it("sem altura livre acima das máquinas, não desenha", () => {
    // vão de 0,304m − 2×0,08 < 0,15m
    const layout = computeLayout({ ...base, ceilingHeightMm: 2290 }, catalog).layout!;
    expect(logoPlacement(layout, 1)).toBeNull();
  });
});
