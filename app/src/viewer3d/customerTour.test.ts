import { describe, expect, it } from "vitest";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, ProjectState } from "../engine/types";
import { doorShouldOpen, facadeDims } from "./facade";
import { customerTourPath, sampleTour, tourDuration } from "./customerTour";

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
  acOverrideBTU: null,
};

describe("customerTourPath", () => {
  it("começa na calçada olhando a fachada e termina dentro da loja", () => {
    const layout = computeLayout(base, catalog).layout!;
    const f = facadeDims(layout);
    const path = customerTourPath(layout);
    const first = path[0];
    const last = path[path.length - 1];
    expect(first.position[2]).toBeGreaterThan(f.frontZ + 3); // na rua
    expect(first.lookAt[2]).toBeLessThan(first.position[2]); // olhando pra loja
    expect(last.position[2]).toBeLessThan(f.wallZ); // dentro
    expect(last.position[0]).toBeGreaterThan(0);
    expect(last.position[0]).toBeLessThan(5);
    for (const k of path) expect(k.position[1]).toBeCloseTo(1.65); // altura de olho
  });

  it("cruza a fachada pela porta de 90cm, dentro da vitrine", () => {
    const layout = computeLayout(base, catalog).layout!;
    const f = facadeDims(layout);
    const path = customerTourPath(layout);
    const doorX = (layout.frontDoor!.x + layout.frontDoor!.width / 2) / 1000;
    // trecho que passa da calçada pra dentro mantém o x da porta
    const crossing = path.filter((k) => k.position[2] > f.wallZ - 1 && k.position[2] < f.frontZ + 3);
    expect(crossing.length).toBeGreaterThan(0);
    for (const k of crossing) {
      expect(k.position[0]).toBeCloseTo(doorX);
      expect(k.position[0]).toBeGreaterThan(f.opening.x0);
      expect(k.position[0]).toBeLessThan(f.opening.x1);
    }
  });

  it("porta já está aberta quando o cliente passa pela vitrine", () => {
    const layout = computeLayout(base, catalog).layout!;
    const f = facadeDims(layout);
    const path = customerTourPath(layout);
    // a cada 0,1s: sempre que a câmera estiver a menos de 1m do vidro, o
    // sensor tem que estar disparado há pelo menos 1s (tempo de abrir)
    let openSince: number | null = null;
    for (let t = 0; t <= tourDuration(path); t += 0.1) {
      const { position } = sampleTour(path, t);
      if (doorShouldOpen(f, position)) openSince ??= t;
      else openSince = null;
      if (Math.abs(position[2] - f.glassZ) < 1) {
        expect(openSince).not.toBeNull();
        expect(t - openSince!).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("depois de entrar a porta fecha e fica fechada até o fim", () => {
    const layout = computeLayout(base, catalog).layout!;
    const f = facadeDims(layout);
    const path = customerTourPath(layout);
    const inside = path.findIndex((k) => k.position[2] < f.wallZ);
    for (let t = path[inside].t; t <= tourDuration(path); t += 0.1) {
      expect(doorShouldOpen(f, sampleTour(path, t).position)).toBe(false);
    }
  });

  it("vai pro canto esquerdo do salão e passeia o olhar da esquerda pra direita", () => {
    for (const state of [
      base,
      { ...base, orientation: "side" as const },
      { ...base, orientation: "side" as const, machineWall: "right" as const },
    ]) {
      const layout = computeLayout(state, catalog).layout!;
      const f = facadeDims(layout);
      const path = customerTourPath(layout);
      const last = path[path.length - 1];
      // canto esquerdo da frente, dentro do salão
      expect(last.position[0]).toBeGreaterThan(f.salon.x0);
      expect(last.position[0]).toBeLessThan((f.salon.x0 + f.salon.x1) / 2);
      expect(last.position[2]).toBeGreaterThan(f.wallZ - 2);
      expect(last.position[2]).toBeLessThan(f.wallZ);
      // parado no canto, o olhar varre do lado esquerdo até o direito, na horizontal
      const atCorner = path.filter((k) => k.position === last.position);
      const xs = atCorner.map((k) => k.lookAt[0]);
      expect(Math.min(...xs)).toBeLessThan(f.salon.x0 + 1);
      expect(Math.max(...xs)).toBeGreaterThan(f.salon.x1 - 1);
      for (const k of atCorner) expect(Math.abs(k.lookAt[1] - k.position[1])).toBeLessThan(0.7);
    }
  });
});

describe("sampleTour", () => {
  const path = customerTourPath(computeLayout(base, catalog).layout!);

  it("nos quadros-chave devolve exatamente o quadro", () => {
    expect(sampleTour(path, 0)).toEqual({ position: path[0].position, lookAt: path[0].lookAt });
    expect(sampleTour(path, path[1].t).position).toEqual(path[1].position);
  });

  it("antes do início e depois do fim fica parado nas pontas", () => {
    expect(sampleTour(path, -5).position).toEqual(path[0].position);
    expect(sampleTour(path, tourDuration(path) + 10).position).toEqual(
      path[path.length - 1].position
    );
  });

  it("entre dois quadros fica no meio do caminho (com suavização)", () => {
    const mid = (path[0].t + path[1].t) / 2;
    const z = sampleTour(path, mid).position[2];
    expect(z).toBeCloseTo((path[0].position[2] + path[1].position[2]) / 2, 5);
  });
});
