import type { Layout } from "../engine/types";
import { facadeDims } from "./facade";

// "Visão do cliente": a câmera anda como uma pessoa (altura de olho) — da
// calçada olhando a fachada, entra pela porta (que fecha atrás), vai pro
// canto esquerdo da frente e passeia o olhar pela loja toda, da parede
// esquerda até a direita. Tudo em metros, no mundo 3D (x = largura, z = comprimento).

type Vec3 = [number, number, number];

export interface TourKeyframe {
  t: number; // segundos desde o início
  position: Vec3;
  lookAt: Vec3;
}

const EYE = 1.65;
const LOOK_Y = 1.3; // olhar quase na horizontal, na altura das máquinas
const INSIDE_STOP = 1.6; // para depois da porta, fora do sensor (porta fecha)
const CORNER_MARGIN = 0.6; // canto: afastado das paredes
const CORNER_DEPTH = 1.3; // canto: afastado da vitrine (fora do sensor)
const FAR_MARGIN = 0.4;

export function customerTourPath(layout: Layout): TourKeyframe[] {
  const f = facadeDims(layout);
  const roomD = layout.roomDepthMm / 1000;

  // Entra pelo meio da porta de vidro da fachada (ela abre sozinha com a
  // câmera chegando perto e fecha depois que ela entra — ver doorShouldOpen).
  const entryX = (f.door.x0 + f.door.x1) / 2;
  const signY = (f.sign.visibleY0 + f.sign.y1) / 2;
  const insideZ = f.glassZ - INSIDE_STOP;

  // Canto esquerdo da frente do salão (na fileira lateral, o salão começa no
  // drywall; a área técnica fica de fora).
  const { x0: salon0, x1: salon1 } = f.salon;
  const corner: Vec3 = [salon0 + CORNER_MARGIN, EYE, f.glassZ - CORNER_DEPTH];
  const leftWall: Vec3 = [salon0 + FAR_MARGIN, LOOK_Y, FAR_MARGIN];
  const backRight: Vec3 = [salon1 - FAR_MARGIN, LOOK_Y, FAR_MARGIN];
  const rightWall: Vec3 = [salon1 - FAR_MARGIN, LOOK_Y, roomD - CORNER_DEPTH];
  const overview: Vec3 = [(salon0 + salon1) / 2 + 0.5, LOOK_Y - 0.2, roomD * 0.35];

  return [
    // Calçada, do outro lado: a fachada inteira e o letreiro
    { t: 0, position: [entryX, EYE, f.frontZ + 7], lookAt: [entryX, signY - 0.6, f.wallZ] },
    // Chega perto, ainda admirando o letreiro (a porta começa a abrir)
    { t: 4, position: [entryX, EYE, f.frontZ + 2.5], lookAt: [entryX, signY - 0.4, f.wallZ] },
    // Na porta, olha pra dentro
    { t: 6.5, position: [entryX, EYE, f.frontZ + 0.6], lookAt: [entryX, 1.4, roomD - 3] },
    // Entrou; para um pouco enquanto a porta fecha atrás
    { t: 9, position: [entryX, EYE, insideZ], lookAt: [entryX, LOOK_Y, roomD - 4] },
    { t: 10.5, position: [entryX, EYE, insideZ], lookAt: [entryX, LOOK_Y, roomD - 4] },
    // Vai pro canto esquerdo, olhando ao longo da parede esquerda
    { t: 13, position: corner, lookAt: leftWall },
    // Passeia o olhar na horizontal: fundo à direita, depois a parede direita
    { t: 16.5, position: corner, lookAt: backRight },
    { t: 19.5, position: corner, lookAt: rightWall },
    // Volta pra uma visão geral da loja
    { t: 22, position: corner, lookAt: overview },
    // Pausa
    { t: 23.5, position: corner, lookAt: overview },
  ];
}

export function tourDuration(path: TourKeyframe[]): number {
  return path[path.length - 1].t;
}

// Suaviza cada trecho (acelera e freia), como alguém andando.
function ease(u: number): number {
  return u * u * (3 - 2 * u);
}

function lerp3(a: Vec3, b: Vec3, u: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

// Posição/alvo da câmera no instante `time` (segundos).
export function sampleTour(path: TourKeyframe[], time: number): { position: Vec3; lookAt: Vec3 } {
  if (time <= path[0].t) return { position: path[0].position, lookAt: path[0].lookAt };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (time <= b.t) {
      const u = ease((time - a.t) / (b.t - a.t));
      return { position: lerp3(a.position, b.position, u), lookAt: lerp3(a.lookAt, b.lookAt, u) };
    }
  }
  const last = path[path.length - 1];
  return { position: last.position, lookAt: last.lookAt };
}
