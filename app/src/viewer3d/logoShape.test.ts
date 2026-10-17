import { describe, expect, it } from "vitest";
import { alphaFromRGBA, traceLogo, type AlphaMask } from "./logoShape";

// Máscara a partir de um desenho ASCII: "#" = opaco, "." = transparente.
function mask(rows: string[]): AlphaMask {
  const height = rows.length;
  const width = rows[0].length;
  const alpha = new Uint8Array(width * height);
  rows.forEach((row, y) => [...row].forEach((ch, x) => (alpha[y * width + x] = ch === "#" ? 255 : 0)));
  return { width, height, alpha };
}

function area(poly: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
}

describe("traceLogo", () => {
  it("imagem toda transparente não gera forma", () => {
    expect(traceLogo(mask(["....", "....", "...."]))).toBeNull();
  });

  it("um quadrado opaco vira uma forma sem furos, com a área certa", () => {
    const out = traceLogo(
      mask(["..........", "..######..", "..######..", "..######..", "..######..", ".........."])
    )!;
    expect(out.shapes).toHaveLength(1);
    expect(out.shapes[0].holes).toHaveLength(0);
    // 6x4 px numa imagem 10x6 → ~0,4 x ~0,67 (contorno passa no meio da borda)
    expect(area(out.shapes[0].outer)).toBeCloseTo((6 / 10) * (4 / 6), 1);
  });

  it("um anel (letra O) vira uma forma com um furo", () => {
    const out = traceLogo(
      mask([
        "..........",
        ".########.",
        ".########.",
        ".##....##.",
        ".##....##.",
        ".##....##.",
        ".########.",
        ".########.",
        "..........",
      ])
    )!;
    expect(out.shapes).toHaveLength(1);
    expect(out.shapes[0].holes).toHaveLength(1);
  });

  it("duas peças separadas viram duas formas", () => {
    const out = traceLogo(
      mask(["...........", ".###...###.", ".###...###.", ".###...###.", "..........."])
    )!;
    expect(out.shapes).toHaveLength(2);
  });

  it("ignora pixels soltos (sujeira) e calcula a caixa só da parte visível", () => {
    const out = traceLogo(
      mask([
        "#...........",
        "............",
        "....####....",
        "....####....",
        "....####....",
        "............",
      ])
    )!;
    expect(out.shapes).toHaveLength(1);
    // caixa em x ~ [4/12, 8/12]; y pra cima: linhas 2–4 de 6 → ~[1/6, 4/6]
    expect(out.bbox.minX).toBeGreaterThan(0.3);
    expect(out.bbox.maxX).toBeLessThan(0.7);
    expect(out.bbox.minY).toBeGreaterThan(0.1);
    expect(out.bbox.maxY).toBeLessThan(0.7);
  });

  it("y sai pra cima (espaço de UV): peça no topo da imagem tem y alto", () => {
    const out = traceLogo(
      mask(["........", ".######.", ".######.", "........", "........", "........"])
    )!;
    expect(out.bbox.minY).toBeGreaterThanOrEqual(0.5);
    expect(out.bbox.maxY).toBeGreaterThan(0.8);
  });

  it("lê o alfa de um RGBA (ImageData)", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 0, 10, 20, 30, 255]);
    expect(Array.from(alphaFromRGBA(rgba, 2, 1).alpha)).toEqual([0, 255]);
  });
});
