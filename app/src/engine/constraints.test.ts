import { describe, expect, it } from "vitest";
import {
  computeMinWidthMm,
  computeMinDepthMm,
  computeMinCeilingMm,
  machineRowWidthMm,
  validate,
} from "./constraints";
import type { CatalogMachine, ProjectState } from "./types";

const stack: CatalogMachine = {
  id: "sq-stack",
  brand: "Speed Queen",
  model: "Stack",
  type: "stack",
  widthMm: 683,
  depthMm: 794,
  heightMm: 1986,
};

describe("constraints — cálculo de mínimos", () => {
  it("calcula a largura da fileira somando larguras + gaps entre máquinas", () => {
    const list = [stack, stack, stack];
    expect(machineRowWidthMm(list)).toBe(683 * 3 + 20 * 2);
  });

  it("largura mínima da sala = fileira + 500mm de cada lado", () => {
    const list = [stack, stack, stack];
    const rowWidth = machineRowWidthMm(list);
    expect(computeMinWidthMm(list)).toBe(rowWidth + 500 + 500);
  });

  it("profundidade mínima = área técnica + máquina mais funda + drywall + salão mínimo", () => {
    const list = [stack];
    expect(computeMinDepthMm(list)).toBe(1050 + 794 + 100 + 1800);
  });

  it("pé-direito mínimo = máquina mais alta + 300mm de folga", () => {
    const list = [stack];
    expect(computeMinCeilingMm(list)).toBe(1986 + 300);
  });

  it("lista vazia retorna zero em todos os mínimos", () => {
    expect(machineRowWidthMm([])).toBe(0);
  });
});

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

const baseState: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 4200,
  ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 1 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  acOverrideBTU: null,
};

describe("validate", () => {
  it("retorna NO_MACHINES quando nenhuma máquina está selecionada", () => {
    const violations = validate({ ...baseState, machines: [] }, catalog);
    expect(violations).toEqual([
      expect.objectContaining({ code: "NO_MACHINES", field: "machines" }),
    ]);
  });

  it("retorna vazio quando a sala atende a todos os mínimos", () => {
    const violations = validate(baseState, catalog);
    expect(violations).toEqual([]);
  });

  it("retorna WIDTH_TOO_SMALL com o valor mínimo sugerido", () => {
    const violations = validate({ ...baseState, roomWidthMm: 1000 }, catalog);
    expect(violations).toEqual([
      expect.objectContaining({
        code: "WIDTH_TOO_SMALL",
        field: "roomWidthMm",
        suggestedValueMm: 683 + 500 + 500,
      }),
    ]);
  });

  it("retorna DEPTH_TOO_SMALL com o valor mínimo sugerido", () => {
    const violations = validate({ ...baseState, roomDepthMm: 1000 }, catalog);
    expect(violations).toEqual([
      expect.objectContaining({
        code: "DEPTH_TOO_SMALL",
        field: "roomDepthMm",
        suggestedValueMm: 1050 + 794 + 100 + 1800,
      }),
    ]);
  });

  it("retorna CEILING_TOO_LOW com o valor mínimo sugerido", () => {
    const violations = validate({ ...baseState, ceilingHeightMm: 1000 }, catalog);
    expect(violations).toEqual([
      expect.objectContaining({
        code: "CEILING_TOO_LOW",
        field: "ceilingHeightMm",
        suggestedValueMm: 1986 + 300,
      }),
    ]);
  });
});
