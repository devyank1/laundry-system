import { DRYWALL_THICKNESS_MM } from "../engine/constants";
import type { Layout } from "../engine/types";
import type { LogoPlacement } from "./placement";

// Fachada no modelo da referência (img/): MOLDURA colorida saltada pra fora
// (pilares + faixa de cima) e, recuado dentro dela, um nicho com o painel do
// letreiro (granilite) em cima e a vitrine de vidro embaixo. A marquise sai
// do pé do painel, avança além da moldura e tem os spots acesos por baixo.
// Fica na parede da frente da planta (z = roomDepth), por fora. Metros.

const M = (mmValue: number) => mmValue / 1000;

// Paredes da sala no 3D (fundo e laterais), por fora do contorno da planta.
export const ROOM_WALL_THICKNESS = 0.1;
const FRAME_DEPTH = 0.35; // moldura: da face interna até a face da rua
const NICHE_RECESS = 0.15; // painel/vitrine recuados atrás da face da moldura
const GLASS_SETBACK = 0.04; // vidro um pouco atrás da face do painel
const PILLAR_WIDTH = 0.35; // moldura de cada lado do nicho
const OPENING_MAX_HEIGHT = 2.5;
const OPENING_CEILING_GAP = 0.3; // vitrine nunca encosta no teto interno
const MARQUEE_THICKNESS = 0.15;
const MARQUEE_PROJECTION = 0.45; // quanto passa da face da moldura
const MARQUEE_OVERHANG = 0.15; // entra na moldura de cada lado
const SIGN_HEIGHT = 1.3; // painel visível, acima da marquise
const TOP_BORDER = 0.3; // moldura acima do painel
const GLASS_PANEL_TARGET_WIDTH = 1.2;
const FRONT_DOOR_WIDTH = 0.9; // porta de vidro de 90cm, quando a planta não define
const FRONT_DOOR_MAX_HEIGHT = 2.2; // acima dela, vidro fixo (bandeira)
const MIN_PANE_WIDTH = 0.05;
const DOWNLIGHT_SPACING = 1.2;

export interface FacadeDims {
  // Bordas da fachada: alinhadas com a face EXTERNA das paredes laterais.
  outerX0: number;
  outerX1: number;
  wallZ: number; // face interna da fachada (= fundo da sala)
  frontZ: number; // face da moldura, na rua
  nicheZ: number; // face do painel recuado
  glassZ: number;
  height: number; // topo da fachada
  // Nicho = vão entre os pilares, do chão até o topo do painel.
  opening: { x0: number; x1: number; height: number };
  // Largura do salão (onde o cliente anda), entre as paredes / drywall.
  salon: { x0: number; x1: number };
  // Porta de vidro (abre pra dentro) e os vidros fixos dos lados dela.
  door: { x0: number; x1: number; height: number };
  glassPanes: { x0: number; x1: number }[];
  marquee: { x0: number; x1: number; y: number; thickness: number; z0: number; z1: number };
  downlightsX: number[];
  // Painel do letreiro: de trás da marquise até o topo do nicho; a parte
  // visível começa em cima da marquise.
  sign: { x0: number; x1: number; y0: number; visibleY0: number; y1: number };
}

export function facadeDims(layout: Layout): FacadeDims {
  const roomW = M(layout.roomWidthMm);
  const ceiling = M(layout.ceilingHeightMm);
  const wallZ = M(layout.roomDepthMm);

  // A vitrine só abre pro salão: na fileira lateral, a área técnica (até a
  // face do drywall) fica atrás da moldura cheia.
  const salonFront = M(layout.drywall.y + DRYWALL_THICKNESS_MM);
  const [salon0, salon1] =
    layout.orientation !== "side"
      ? [0, roomW]
      : layout.machineWall === "left"
        ? [salonFront, roomW]
        : [0, roomW - salonFront];
  const x0 = salon0 + PILLAR_WIDTH;
  const x1 = salon1 - PILLAR_WIDTH;

  const openingH = Math.min(OPENING_MAX_HEIGHT, ceiling - OPENING_CEILING_GAP);
  const marqueeTop = openingH + MARQUEE_THICKNESS;
  const signY1 = marqueeTop + SIGN_HEIGHT;

  const frontZ = wallZ + FRAME_DEPTH;
  const nicheZ = frontZ - NICHE_RECESS;

  const openW = x1 - x0;

  // Porta na posição da porta de 90cm da planta, sempre dentro da vitrine.
  const front = layout.frontDoor;
  const doorW = Math.min(front ? M(front.width) : FRONT_DOOR_WIDTH, openW);
  const wantX = front ? M(front.x + front.width / 2) : (x0 + x1) / 2;
  const doorX = Math.min(Math.max(wantX, x0 + doorW / 2), x1 - doorW / 2);
  const door = {
    x0: doorX - doorW / 2,
    x1: doorX + doorW / 2,
    height: Math.min(FRONT_DOOR_MAX_HEIGHT, openingH),
  };
  const glassPanes = [
    ...splitPanes(x0, door.x0),
    ...splitPanes(door.x1, x1),
  ];
  const lights = Math.max(2, Math.round(openW / DOWNLIGHT_SPACING) + 1);
  const downlightsX = Array.from(
    { length: lights },
    (_, i) => x0 + ((i + 0.5) * openW) / lights
  );

  return {
    outerX0: -ROOM_WALL_THICKNESS,
    outerX1: roomW + ROOM_WALL_THICKNESS,
    wallZ,
    frontZ,
    nicheZ,
    glassZ: nicheZ - GLASS_SETBACK,
    height: signY1 + TOP_BORDER,
    opening: { x0, x1, height: openingH },
    salon: { x0: salon0, x1: salon1 },
    door,
    glassPanes,
    marquee: {
      x0: x0 - MARQUEE_OVERHANG,
      x1: x1 + MARQUEE_OVERHANG,
      y: openingH,
      thickness: MARQUEE_THICKNESS,
      z0: nicheZ,
      z1: frontZ + MARQUEE_PROJECTION,
    },
    downlightsX,
    sign: { x0, x1, y0: openingH, visibleY0: marqueeTop, y1: signY1 },
  };
}

// Trecho de vitrine fixa dividido em vidros de ~1,20m.
function splitPanes(x0: number, x1: number): { x0: number; x1: number }[] {
  const w = x1 - x0;
  if (w < MIN_PANE_WIDTH) return [];
  const n = Math.max(1, Math.round(w / GLASS_PANEL_TARGET_WIDTH));
  return Array.from({ length: n }, (_, i) => ({ x0: x0 + (w * i) / n, x1: x0 + (w * (i + 1)) / n }));
}

// Quanto a porta da frente abre (0 = fechada, 1 = aberta) com alguém em
// (x, y, z): abre quando uma pessoa (câmera na altura do olho) chega perto,
// de fora ou de dentro, e fecha logo que ela entra. A câmera da órbita, lá
// em cima, não abre.
const DOOR_SENSOR_REACH_OUT = 3; // metros na frente do vidro (calçada)
const DOOR_SENSOR_REACH_IN = 1; // por dentro: passou disso, a porta fecha
const DOOR_SENSOR_SIDE = 1.2; // folga pros lados da porta
const DOOR_SENSOR_MAX_Y = 2.5;

export function doorShouldOpen(dims: FacadeDims, [x, y, z]: [number, number, number]): boolean {
  const { door, glassZ } = dims;
  return (
    y < DOOR_SENSOR_MAX_Y &&
    z < glassZ + DOOR_SENSOR_REACH_OUT &&
    z > glassZ - DOOR_SENSOR_REACH_IN &&
    x > door.x0 - DOOR_SENSOR_SIDE &&
    x < door.x1 + DOOR_SENSOR_SIDE
  );
}

const SIGN_LOGO_MAX_WIDTH = 0.85;
const SIGN_LOGO_MAX_HEIGHT = 0.7;

// Logo centrada na parte visível do painel (acima da marquise), virada pra rua (+z).
export function facadeLogoPlacement(
  dims: FacadeDims,
  aspect: number,
  standoffM: number
): LogoPlacement | null {
  if (!(aspect > 0)) return null;
  const { sign } = dims;
  const maxW = (sign.x1 - sign.x0) * SIGN_LOGO_MAX_WIDTH;
  const maxH = (sign.y1 - sign.visibleY0) * SIGN_LOGO_MAX_HEIGHT;
  const height = Math.min(maxH, maxW / aspect);
  return {
    position: [
      (sign.x0 + sign.x1) / 2,
      (sign.visibleY0 + sign.y1) / 2,
      dims.nicheZ + standoffM,
    ],
    yaw: 0,
    width: height * aspect,
    height,
  };
}
