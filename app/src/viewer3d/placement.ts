import { DRYWALL_THICKNESS_MM } from "../engine/constants";
import type { Layout, Rect, WallSide } from "../engine/types";

// Todos os modelos 3D têm a frente nativa voltada pra +z e as costas pra -z.
// Estes helpers só fazem a conta de "pra onde virar" e "qual caixa usar" —
// a mesma troca de eixos que o motor faz em layout.ts, agora em metros e no
// plano XZ do three.js (x = largura da planta, z = comprimento/y da planta).

const M = (mmValue: number) => mmValue / 1000;

// Rotação em Y que deixa as costas do item na parede `wall` e a frente
// virada pra dentro da sala.
export function wallYaw(wall: WallSide): number {
  switch (wall) {
    case "left":
      return Math.PI / 2;
    case "right":
      return -Math.PI / 2;
    case "top":
      return 0;
    case "bottom":
      return Math.PI;
  }
}

function isQuarterTurn(yaw: number): boolean {
  return Math.abs(Math.abs(yaw) - Math.PI / 2) < 1e-6;
}

// Caixa [w, h, d] no referencial NATIVO do modelo (antes de girar), a partir
// das extensões reais no mundo (x, z). Girando 90°, x e z trocam.
export function fitSize(
  worldX: number,
  height: number,
  worldZ: number,
  yaw: number
): [number, number, number] {
  return isQuarterTurn(yaw) ? [worldZ, height, worldX] : [worldX, height, worldZ];
}

// Centro de um Rect da planta (mm) no chão do mundo 3D (m): [x, z].
export function rectCenter(r: Rect): [number, number] {
  return [M(r.x + r.width / 2), M(r.y + r.height / 2)];
}

// Referencial da parede das máquinas (drywall), em metros:
//   along  = eixo da fileira (x em "back", z em "side")
//   across = da parede da fileira pro salão (z em "back", x em "side";
//            espelhado quando a fileira está na parede direita)
export interface DrywallFrame {
  // Posição no mundo [x, y, z] a partir de (along, altura, across).
  pos: (along: number, y: number, across: number) => [number, number, number];
  // Tamanho de caixa no mundo a partir de (extensão along, altura, extensão across).
  size: (along: number, h: number, across: number) => [number, number, number];
  // Rotação dos itens embutidos no drywall (máquinas, totem), frente pro salão.
  yaw: number;
  // Rotação de peças cilíndricas deitadas ao longo do eixo along (maçaneta).
  alongBarRotation: [number, number, number];
  alongLength: number;
  // Trecho [start, end] (m, no eixo along) de um retângulo-marcador do motor
  // (vão de máquina, porta: extensão along sempre em `width`).
  markerSpan: (r: Rect) => { start: number; end: number };
  // Idem pra um retângulo "espacial" (corredor técnico: extensão along é
  // `width` em "back" e `height` em "side").
  spatialSpan: (r: Rect) => { start: number; end: number };
}

const LOGO_MARGIN_M = 0.08; // folga da logo até o topo da máquina e até o teto
const LOGO_MIN_HEIGHT_M = 0.15; // menos que isso não dá pra ler: não desenha
const LOGO_MAX_ROW_FRACTION = 0.9; // no máximo 90% do comprimento da fileira

export interface LogoPlacement {
  position: [number, number, number];
  yaw: number;
  width: number;
  height: number;
}

// Logo no drywall, centrada em cima da fileira de máquinas, no vão entre o
// topo da máquina mais alta e o teto. Mantém a proporção da imagem
// (`aspect` = largura/altura). null se não sobra altura pra ela.
// `standoffM` = distância da face do drywall até as costas da logo.
export function logoPlacement(
  layout: Layout,
  aspect: number,
  standoffM = 0.006
): LogoPlacement | null {
  const openings = layout.drywall.openings;
  if (openings.length === 0 || !(aspect > 0)) return null;
  const frame = drywallFrame(layout);
  const spans = openings.map(frame.markerSpan);
  const rowStart = Math.min(...spans.map((s) => s.start));
  const rowEnd = Math.max(...spans.map((s) => s.end));
  const machineTop = Math.max(...openings.map((o) => M(o.height)));
  const wallH = M(layout.drywall.heightMm);

  const maxHeight = wallH - machineTop - LOGO_MARGIN_M * 2;
  if (maxHeight < LOGO_MIN_HEIGHT_M) return null;
  const maxWidth = (rowEnd - rowStart) * LOGO_MAX_ROW_FRACTION;
  const height = Math.min(maxHeight, maxWidth / aspect);
  const width = height * aspect;

  // À frente da face do drywall (lado do salão) — no mínimo uns milímetros,
  // pra não "brigar" com a parede no z-buffer.
  const across = M(layout.drywall.y + DRYWALL_THICKNESS_MM) + standoffM;
  return {
    position: frame.pos((rowStart + rowEnd) / 2, machineTop + (wallH - machineTop) / 2, across),
    yaw: frame.yaw,
    width,
    height,
  };
}

// As máquinas entram no vão do drywall: a frente fica a 1 cm da face do salão
// (o motor as posiciona rentes à face de trás, 10 cm recuadas). Só visual 3D.
export const MACHINE_DRYWALL_GAP_MM = 10;
export const MACHINE_FORWARD_M = (DRYWALL_THICKNESS_MM - MACHINE_DRYWALL_GAP_MM) / 1000;

export function drywallFrame(layout: Layout): DrywallFrame {
  const roomW = M(layout.roomWidthMm);
  if (layout.orientation !== "side") {
    return {
      pos: (a, y, c) => [a, y, c],
      size: (a, h, c) => [a, h, c],
      yaw: 0,
      alongBarRotation: [0, 0, Math.PI / 2],
      alongLength: M(layout.roomWidthMm),
      markerSpan: (r) => ({ start: M(r.x), end: M(r.x + r.width) }),
      spatialSpan: (r) => ({ start: M(r.x), end: M(r.x + r.width) }),
    };
  }
  const mirrored = layout.machineWall === "right";
  return {
    pos: (a, y, c) => [mirrored ? roomW - c : c, y, a],
    size: (a, h, c) => [c, h, a],
    yaw: wallYaw(layout.machineWall),
    alongBarRotation: [Math.PI / 2, 0, 0],
    alongLength: M(layout.roomDepthMm),
    markerSpan: (r) => ({ start: M(r.y), end: M(r.y + r.width) }),
    spatialSpan: (r) => ({ start: M(r.y), end: M(r.y + r.height) }),
  };
}
