import { describe, expect, it } from "vitest";
import { suggestBTU } from "./btu";

describe("suggestBTU", () => {
  it("20m² com 2 secadoras sugere 18000 BTU (base 16000)", () => {
    expect(suggestBTU(20, 2)).toBe(18000);
  });

  it("10m² sem secadora sugere 9000 BTU (base 6000)", () => {
    expect(suggestBTU(10, 0)).toBe(9000);
  });

  it("área muito grande satura no maior tamanho comercial (60000)", () => {
    expect(suggestBTU(200, 10)).toBe(60000);
  });

  it("base exatamente igual a um tamanho comercial retorna esse tamanho", () => {
    expect(suggestBTU(15, 0)).toBe(9000); // 15*600=9000
  });
});
