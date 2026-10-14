import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import type { CatalogMachine, ProjectState } from "./types";

const catalog: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
  },
];

const validState: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 4200,
  ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 3 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  furnitureSide: "left",
  acOverrideBTU: null,
};

describe("computeLayout", () => {
  it("retorna layout null e violações quando a sala é pequena demais", () => {
    const result = computeLayout({ ...validState, roomWidthMm: 1000 }, catalog);
    expect(result.layout).toBeNull();
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("posiciona uma máquina por instância, sem sobreposição, dentro da sala", () => {
    const result = computeLayout(validState, catalog);
    expect(result.violations).toEqual([]);
    expect(result.layout).not.toBeNull();
    const placed = result.layout!.machines;
    expect(placed).toHaveLength(3);
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i].x).toBeGreaterThanOrEqual(placed[i - 1].x + placed[i - 1].widthMm);
    }
    for (const m of placed) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x + m.widthMm).toBeLessThanOrEqual(validState.roomWidthMm);
    }
  });

  it("gera um vão de drywall por máquina posicionada", () => {
    const result = computeLayout(validState, catalog);
    expect(result.layout!.drywall.openings).toHaveLength(3);
  });

  it("deixa o corredor técnico do lado escolhido (right = encostado na parede direita)", () => {
    const result = computeLayout(validState, catalog);
    const corridor = result.layout!.techCorridor;
    expect(corridor.x).toBe(validState.roomWidthMm - 700);
    expect(corridor.width).toBe(700);
  });

  it("começa a fileira a 500mm da parede do lado oposto à porta técnica", () => {
    const right = computeLayout(validState, catalog).layout!;
    expect(right.machines[0].x).toBe(500);

    const left = computeLayout({ ...validState, techAccessSide: "left" }, catalog).layout!;
    const last = left.machines[left.machines.length - 1];
    expect(last.x + last.widthMm).toBe(validState.roomWidthMm - 500);
  });

  it("coloca a porta técnica de 70cm no drywall, no corredor técnico", () => {
    const layout = computeLayout(validState, catalog).layout!;
    expect(layout.techDoor).toEqual({
      x: validState.roomWidthMm - 700,
      y: layout.drywall.y,
      width: 700,
      height: 0,
    });
  });

  it("deixa o corredor técnico do lado esquerdo quando techAccessSide=left", () => {
    const result = computeLayout({ ...validState, techAccessSide: "left" }, catalog);
    const corridor = result.layout!.techCorridor;
    expect(corridor.x).toBe(0);
  });

  it("inclui mobiliário quando furnitureEnabled=true", () => {
    const result = computeLayout(validState, catalog);
    expect(result.layout!.furniture).not.toBeNull();
    expect(result.layout!.furniture!.poufs).toHaveLength(3);
  });

  it("usa poofs redondos de 50cm ao redor da mesa", () => {
    const furniture = computeLayout(validState, catalog).layout!.furniture!;
    for (const p of furniture.poufs) {
      expect(p.width).toBe(500);
      expect(p.height).toBe(500);
    }
  });

  it("embute o totem no seu próprio trecho de 50cm, no lado OPOSTO à porta técnica", () => {
    // validState: techAccessSide="right" → porta técnica fica na direita,
    // então o totem (lado oposto) deve ficar na faixa de 50cm da esquerda,
    // independente de onde a fileira de máquinas termina.
    const layout = computeLayout(validState, catalog).layout!;
    const totem = layout.furniture!.totem;
    expect(totem.y).toBe(layout.drywall.y);
    expect(totem.width).toBe(400);
    expect(totem.x).toBe((500 - 400) / 2); // centralizado na faixa [0, 500]
    expect(totem.x + totem.width).toBeLessThanOrEqual(500);

    const left = computeLayout({ ...validState, techAccessSide: "left" }, catalog).layout!;
    const leftTotem = left.furniture!.totem;
    const leftStripX = left.roomWidthMm - 500; // faixa [roomWidth-500, roomWidth] do lado direito
    expect(leftTotem.x).toBe(leftStripX + (500 - 400) / 2);
    expect(leftTotem.x).toBeGreaterThanOrEqual(leftStripX);
  });

  it("agrupa mesa+poofs+ar-condicionado num bloco só, encostado no canto do lado escolhido (furnitureSide)", () => {
    const layout = computeLayout(validState, catalog).layout!; // furnitureSide: "left"
    const { ac, acWall, table, poufs } = layout.furniture!;
    const salonFront = layout.drywall.y + 100;
    const salonCenter = (salonFront + validState.roomDepthMm) / 2;

    expect(acWall).toBe("left");
    expect(ac.x).toBe(0);
    expect(ac.y + ac.height / 2).toBeCloseTo(salonCenter, 0);

    // bloco mesa+poofs encostado no canto esquerdo, não mais centralizado na sala
    const leftChair = poufs[0];
    expect(leftChair.x).toBe(100); // margem (FURNITURE_MARGIN_MM), poof encostado nela
    expect(table.x).toBe(leftChair.x + 500 + 50); // depois do poof + vão
    expect(table.x).toBeLessThan(validState.roomWidthMm / 2);

    const right = computeLayout({ ...validState, furnitureSide: "right" }, catalog).layout!;
    expect(right.furniture!.acWall).toBe("right");
    expect(right.furniture!.ac.x + right.furniture!.ac.width).toBe(validState.roomWidthMm);
    const rightChair = right.furniture!.poufs[1];
    expect(rightChair.x + rightChair.width).toBe(validState.roomWidthMm - 100); // encostado na margem direita
    expect(right.furniture!.table.x).toBeGreaterThan(validState.roomWidthMm / 2);
  });

  it("omite mobiliário quando furnitureEnabled=false", () => {
    const result = computeLayout({ ...validState, furnitureEnabled: false }, catalog);
    expect(result.layout!.furniture).toBeNull();
  });

  it("sugere BTU pela fórmula quando não há override", () => {
    const result = computeLayout(validState, catalog);
    const areaM2 = (validState.roomWidthMm / 1000) * (validState.roomDepthMm / 1000);
    expect(result.layout!.acSuggestedBTU).toBeGreaterThan(0);
    expect(result.layout!.acSuggestedBTU).toBeGreaterThanOrEqual(areaM2 * 600);
  });

  it("usa o override de BTU quando informado", () => {
    const result = computeLayout({ ...validState, acOverrideBTU: 36000 }, catalog);
    expect(result.layout!.acSuggestedBTU).toBe(36000);
  });

  it("inclui a porta frontal centralizada quando doorEnabled=true", () => {
    const result = computeLayout(validState, catalog);
    const door = result.layout!.frontDoor;
    expect(door).not.toBeNull();
    expect(door!.x + door!.width / 2).toBeCloseTo(validState.roomWidthMm / 2, 0);
    expect(door!.y).toBe(validState.roomDepthMm);
  });

  it("omite a porta frontal quando doorEnabled=false", () => {
    const result = computeLayout({ ...validState, doorEnabled: false }, catalog);
    expect(result.layout!.frontDoor).toBeNull();
  });

  it("alinha a face frontal de cada máquina com a linha do drywall", () => {
    const result = computeLayout(validState, catalog);
    for (const m of result.layout!.machines) {
      expect(m.y + m.depthMm).toBe(result.layout!.drywall.y);
    }
  });
});
