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
  roomDepthMm: 5500, // dá espaço pra fileira mesa+2 cadeiras encostada na parede (~3,0m)
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
    expect(result.layout!.furniture!.poufs).toHaveLength(2);
  });

  it("usa cadeiras quadradas de 42cm, em fileira logo depois da mesa", () => {
    const furniture = computeLayout(validState, catalog).layout!.furniture!;
    const [chair1, chair2] = furniture.poufs;
    for (const c of furniture.poufs) {
      expect(c.width).toBe(420);
      expect(c.height).toBe(420);
    }
    // encostadas na mesma parede da mesa (furnitureSide="left" → x=0), uma
    // logo depois da outra em y, continuando a fileira a partir da mesa
    expect(chair1.x).toBe(0);
    expect(chair1.y).toBe(furniture.table.y + furniture.table.height + 100);
    expect(chair2.x).toBe(0);
    expect(chair2.y).toBe(chair1.y + 420 + 100);
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

  it("encosta a mesa na parede perto das máquinas (início do salão), lado escolhido (furnitureSide)", () => {
    const layout = computeLayout(validState, catalog).layout!; // furnitureSide: "left"
    const { ac, acWall, table } = layout.furniture!;
    const salonFrontY = layout.drywall.y + 100;
    const salonCenter = (salonFrontY + validState.roomDepthMm) / 2;

    expect(acWall).toBe("left");
    expect(ac.x).toBe(0);
    expect(ac.y + ac.height / 2).toBeCloseTo(salonCenter, 0);

    // mesa virada (2m de comprimento entrando sala adentro, perpendicular à
    // parede esquerda), a 1,00m da frente da máquina (linha do drywall) pra
    // trânsito de pessoas — não mais centralizada nem colada no salão
    expect(table.x).toBe(0);
    expect(table.y).toBe(layout.drywall.y + 1000);
    expect(table.width).toBe(2000);
    expect(table.height).toBe(800);

    const right = computeLayout({ ...validState, furnitureSide: "right" }, catalog).layout!;
    expect(right.furniture!.acWall).toBe("right");
    expect(right.furniture!.ac.x + right.furniture!.ac.width).toBe(validState.roomWidthMm);
    expect(right.furniture!.table.x + right.furniture!.table.width).toBe(validState.roomWidthMm);
    expect(right.furniture!.table.y).toBe(right.drywall.y + 1000);
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
