import { describe, expect, it } from "vitest";
import {
  LATERAL_CLEARANCE_MM,
  TECH_AREA_DEFAULT_MM,
  TECH_AREA_MIN_MM,
  TECH_AREA_MAX_MM,
  AC_SIZES_BTU,
} from "./constants";

describe("engine constants", () => {
  it("mantém a área técnica padrão dentro da faixa 1000-1100mm", () => {
    expect(TECH_AREA_DEFAULT_MM).toBeGreaterThanOrEqual(TECH_AREA_MIN_MM);
    expect(TECH_AREA_DEFAULT_MM).toBeLessThanOrEqual(TECH_AREA_MAX_MM);
  });

  it("mantém a folga lateral em 500mm (50cm)", () => {
    expect(LATERAL_CLEARANCE_MM).toBe(500);
  });

  it("lista tamanhos comerciais de BTU em ordem crescente", () => {
    const sorted = [...AC_SIZES_BTU].sort((a, b) => a - b);
    expect(AC_SIZES_BTU).toEqual(sorted);
  });
});
