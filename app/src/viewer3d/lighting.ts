import type { Layout } from "../engine/types";
import { PLAN_COLORS } from "../viewer2d/planTheme";

export type SceneLighting = "day" | "night";

const PANEL_SPACING_M = 2.0; // um painel de LED a cada ~2m
const MAX_PANELS = 16;
export const CEILING_PANEL_SIZE_M = 0.6; // painel de LED 60x60

// Painéis de LED do teto em grade regular sobre a sala inteira, centrados em
// cada célula. [x, z] em metros.
export function ceilingLightPositions(layout: Layout): [number, number][] {
  const w = layout.roomWidthMm / 1000;
  const d = layout.roomDepthMm / 1000;
  let spacing = PANEL_SPACING_M;
  let nx = Math.max(1, Math.round(w / spacing));
  let nz = Math.max(1, Math.round(d / spacing));
  while (nx * nz > MAX_PANELS) {
    spacing *= 1.15;
    nx = Math.max(1, Math.round(w / spacing));
    nz = Math.max(1, Math.round(d / spacing));
  }
  const out: [number, number][] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      out.push([((i + 0.5) * w) / nx, ((j + 0.5) * d) / nz]);
    }
  }
  return out;
}

export interface LightingPreset {
  background: string;
  ambient: number;
  sun: number;
  environment: number; // reflexos (inox, vidro)
  panelLight: number; // cada luz do teto
  facadeSpot: number; // cada spot da marquise
}

// Dia: sol e reflexos normais + luzes do teto discretas. Noite: fundo escuro e
// quase nenhuma luz de fora — o que ilumina a loja são os painéis do teto e os
// spots da marquise.
export const LIGHTING_PRESETS: Record<SceneLighting, LightingPreset> = {
  day: {
    background: PLAN_COLORS.background, // igual ao app
    ambient: 0.75,
    sun: 1,
    environment: 1,
    panelLight: 1.2,
    facadeSpot: 0.4,
  },
  night: {
    background: "#05070f",
    ambient: 0.12,
    sun: 0.05,
    environment: 0.2,
    panelLight: 5,
    facadeSpot: 3,
  },
};

// Luzes de verdade: cada pointLight entra no cálculo de TODO pixel da tela,
// então os painéis (só visuais) são agrupados em no máximo `perAxis` x
// `perAxis` blocos, cada um com uma luz no centro e a força somada dos
// painéis do bloco. [x, z, quantos painéis].
export function clusterLights(points: [number, number][], perAxis = 2): [number, number, number][] {
  if (points.length === 0) return [];
  const split = (values: number[]) => {
    const sorted = [...new Set(values.map((v) => +v.toFixed(3)))].sort((a, b) => a - b);
    const k = Math.min(perAxis, sorted.length);
    // limites entre os blocos, por quantidade de colunas/linhas distintas
    return Array.from({ length: k - 1 }, (_, i) => sorted[Math.round(((i + 1) * sorted.length) / k) - 1]);
  };
  const bx = split(points.map((p) => p[0]));
  const bz = split(points.map((p) => p[1]));
  const cell = (v: number, bounds: number[]) => bounds.filter((b) => v > b + 1e-6).length;
  const groups = new Map<string, [number, number][]>();
  for (const p of points) {
    const key = `${cell(p[0], bx)}|${cell(p[1], bz)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].map((g) => [
    g.reduce((a, p) => a + p[0], 0) / g.length,
    g.reduce((a, p) => a + p[1], 0) / g.length,
    g.length,
  ]);
}
