import { describe, expect, it } from "vitest";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, ProjectState } from "../engine/types";
import { doorShouldOpen, facadeDims, facadeLogoPlacement } from "./facade";

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

describe("facadeDims", () => {
  it("em 'back' a vitrine ocupa a frente toda menos os pilares, na parede da frente", () => {
    const d = facadeDims(computeLayout(base, catalog).layout!);
    expect(d.wallZ).toBe(6);
    expect(d.opening.x0).toBeCloseTo(0.35);
    expect(d.opening.x1).toBeCloseTo(5 - 0.35);
    expect(d.opening.height).toBeCloseTo(2.5);
    // marquise logo acima da vitrine; painel continua da marquise pra cima,
    // sem vão; moldura acima do painel
    expect(d.marquee.y).toBeCloseTo(d.opening.height);
    expect(d.sign.y0).toBeCloseTo(d.opening.height);
    expect(d.sign.visibleY0).toBeCloseTo(d.marquee.y + d.marquee.thickness);
    expect(d.height).toBeGreaterThan(d.sign.y1);
    expect(d.glassPanes.length).toBeGreaterThanOrEqual(2);
  });

  it("painel e vitrine ficam recuados; moldura e marquise saltam pra rua", () => {
    const d = facadeDims(computeLayout(base, catalog).layout!);
    expect(d.frontZ).toBeGreaterThan(d.nicheZ); // moldura à frente do painel
    expect(d.nicheZ).toBeGreaterThan(d.wallZ);
    expect(d.glassZ).toBeLessThan(d.nicheZ); // vidro atrás da face do painel
    expect(d.marquee.z0).toBeCloseTo(d.nicheZ); // marquise nasce no painel
    expect(d.marquee.z1).toBeGreaterThan(d.frontZ); // e passa da moldura
    // marquise entra um pouco na moldura dos dois lados (se completa com a borda)
    expect(d.marquee.x0).toBeLessThan(d.opening.x0);
    expect(d.marquee.x1).toBeGreaterThan(d.opening.x1);
  });

  it("bordas da fachada alinham com a face externa das paredes laterais (10cm)", () => {
    for (const orientation of ["back", "side"] as const) {
      const d = facadeDims(computeLayout({ ...base, orientation }, catalog).layout!);
      expect(d.outerX0).toBeCloseTo(-0.1);
      expect(d.outerX1).toBeCloseTo(5.1);
    }
  });

  it("pé-direito baixo: vitrine fica 30cm abaixo do teto", () => {
    const d = facadeDims(computeLayout({ ...base, ceilingHeightMm: 2500 }, catalog).layout!);
    expect(d.opening.height).toBeCloseTo(2.2);
  });

  it("na fileira lateral a vitrine só abre pro salão (área técnica atrás de parede cheia)", () => {
    const left = computeLayout({ ...base, orientation: "side" }, catalog).layout!;
    const dl = facadeDims(left);
    const salonFront = (left.drywall.y + 100) / 1000;
    expect(dl.opening.x0).toBeCloseTo(salonFront + 0.35);
    expect(dl.opening.x1).toBeCloseTo(5 - 0.35);

    const right = computeLayout({ ...base, orientation: "side", machineWall: "right" }, catalog)
      .layout!;
    const dr = facadeDims(right);
    expect(dr.opening.x0).toBeCloseTo(0.35);
    expect(dr.opening.x1).toBeCloseTo(5 - salonFront - 0.35);
  });

  it("spots ficam embaixo da marquise, dentro da largura da vitrine", () => {
    const d = facadeDims(computeLayout(base, catalog).layout!);
    expect(d.downlightsX.length).toBeGreaterThanOrEqual(2);
    for (const x of d.downlightsX) {
      expect(x).toBeGreaterThan(d.opening.x0);
      expect(x).toBeLessThan(d.opening.x1);
    }
  });
});

describe("porta de vidro da fachada", () => {
  it("fica no lugar da porta de 90cm da planta; vidros fixos cobrem o resto sem sobrepor", () => {
    const layout = computeLayout(base, catalog).layout!;
    const d = facadeDims(layout);
    const door = layout.frontDoor!;
    expect(d.door.x0).toBeCloseTo(door.x / 1000);
    expect(d.door.x1).toBeCloseTo((door.x + door.width) / 1000);
    expect(d.door.height).toBeCloseTo(2.2);
    // vidros fixos + porta cobrem a vitrine toda, em ordem, sem buracos
    const pieces = [...d.glassPanes, d.door].sort((a, b) => a.x0 - b.x0);
    expect(pieces[0].x0).toBeCloseTo(d.opening.x0);
    expect(pieces[pieces.length - 1].x1).toBeCloseTo(d.opening.x1);
    for (let i = 1; i < pieces.length; i++) expect(pieces[i].x0).toBeCloseTo(pieces[i - 1].x1);
  });

  it("nunca sai da vitrine, mesmo sem porta na planta", () => {
    const layout = computeLayout({ ...base, doorEnabled: false }, catalog).layout!;
    const d = facadeDims(layout);
    expect(d.door.x0).toBeGreaterThanOrEqual(d.opening.x0 - 1e-9);
    expect(d.door.x1).toBeLessThanOrEqual(d.opening.x1 + 1e-9);
    expect(d.door.x1 - d.door.x0).toBeCloseTo(0.9);
  });

  it("sensor: abre com pessoa perto (fora ou dentro); fechada longe ou com a câmera lá em cima", () => {
    const d = facadeDims(computeLayout(base, catalog).layout!);
    const cx = (d.door.x0 + d.door.x1) / 2;
    expect(doorShouldOpen(d, [cx, 1.65, d.frontZ + 2])).toBe(true); // chegando da calçada
    expect(doorShouldOpen(d, [cx, 1.65, d.wallZ - 0.5])).toBe(true); // passando a porta
    expect(doorShouldOpen(d, [cx, 1.65, d.wallZ - 1.5])).toBe(false); // entrou: fecha
    expect(doorShouldOpen(d, [cx, 1.65, d.frontZ + 7])).toBe(false); // do outro lado da rua
    expect(doorShouldOpen(d, [cx, 1.65, 2])).toBe(false); // lá no fundo da loja
    expect(doorShouldOpen(d, [cx, 7, d.frontZ + 2])).toBe(false); // órbita, vista de cima
  });
});

describe("facadeLogoPlacement", () => {
  it("centra a logo no painel, virada pra rua, mantendo a proporção", () => {
    const d = facadeDims(computeLayout(base, catalog).layout!);
    const p = facadeLogoPlacement(d, 3, 0.02)!;
    expect(p.position[0]).toBeCloseTo((d.sign.x0 + d.sign.x1) / 2);
    expect(p.position[1]).toBeCloseTo((d.sign.visibleY0 + d.sign.y1) / 2);
    expect(p.position[2]).toBeCloseTo(d.nicheZ + 0.02); // na face do painel recuado
    expect(p.yaw).toBe(0);
    expect(p.width / p.height).toBeCloseTo(3);
    expect(p.width).toBeLessThanOrEqual((d.sign.x1 - d.sign.x0) * 0.85 + 1e-9);
    expect(p.height).toBeLessThanOrEqual((d.sign.y1 - d.sign.visibleY0) * 0.7 + 1e-9);
  });
});
