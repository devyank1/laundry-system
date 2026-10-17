import { describe, expect, it } from "vitest";
import { drywallColorFor } from "./colors";

function channels(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

describe("drywallColorFor", () => {
  it("verde padrão da fachada vira o verde-sálvia escuro", () => {
    expect(drywallColorFor("#8fa892")).toBe("#5b765f");
  });

  it("sempre mais escura, mantendo o tom (canal dominante continua o mesmo)", () => {
    for (const hex of ["#1e3a8a", "#dc2626", "#f59e0b", "#a8977c"]) {
      const before = channels(hex);
      const after = channels(drywallColorFor(hex));
      const sum = (c: number[]) => c.reduce((a, b) => a + b, 0);
      expect(sum(after)).toBeLessThan(sum(before));
      expect(after.indexOf(Math.max(...after))).toBe(before.indexOf(Math.max(...before)));
    }
  });

  it("cinzas continuam cinzas; preto não passa do mínimo", () => {
    const [r, g, b] = channels(drywallColorFor("#999999"));
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(drywallColorFor("#000000")).toBe("#141414"); // luminosidade mínima 8%
  });
});
