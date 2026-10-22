import { describe, expect, it } from "vitest";
import { cablePoints, type Vec3 } from "./cablePath";

describe("cablePoints", () => {
  const route: Vec3[] = [
    [0, 1, 0],
    [0, 0.8, 0],
    [0, 0.8, 0.6], // trecho horizontal de 60 cm
    [0.1, 0.8, 0.6],
  ];

  it("mantém as pontas e todos os pontos originais (plugue e conexão no lugar)", () => {
    const pts = cablePoints(route);
    expect(pts[0]).toEqual(route[0]);
    expect(pts[pts.length - 1]).toEqual(route[route.length - 1]);
    for (const p of route) expect(pts).toContainEqual(p);
  });

  it("trecho com vão faz barriga pra baixo, proporcional ao comprimento (fio com folga)", () => {
    const pts = cablePoints(route);
    const mid = pts.filter((p) => p[2] > 0.05 && p[2] < 0.55);
    expect(mid.length).toBeGreaterThan(0);
    for (const p of mid) expect(p[1]).toBeLessThan(0.8);
    // 60 cm de vão, folga de 30%: o meio cai uns 18 cm
    expect(Math.min(...mid.map((p) => p[1]))).toBeCloseTo(0.8 - 0.6 * 0.3, 2);
    // e ondula um pouco pro lado
    expect(mid.some((p) => Math.abs(p[0]) > 0.001)).toBe(true);
  });

  it("barriga limitada e nunca abaixo do piso", () => {
    const low: Vec3[] = [
      [0, 0.02, 0],
      [0, 0.02, 3],
    ];
    for (const p of cablePoints(low)) expect(p[1]).toBeGreaterThanOrEqual(0.006);
    const high: Vec3[] = [
      [0, 1, 0],
      [0, 1, 5],
    ];
    const ys = cablePoints(high).map((p) => p[1]);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(1 - 0.5 - 1e-9);
  });

  it("trecho vertical só segue reto (não entra na máquina pro lado)", () => {
    const pts = cablePoints([
      [0.2, 1.5, 0.3],
      [0.2, 1.0, 0.3],
    ]);
    for (const p of pts) {
      expect(p[0]).toBeCloseTo(0.2);
      expect(p[2]).toBeCloseTo(0.3);
    }
  });
});
