import {
  countDryers,
  flattenSelection,
  machineRowWidthMm,
  resolveSelection,
  validate,
} from "./constraints";
import { suggestBTU } from "./btu";
import { computeExhaust } from "./exhaust";
import { computeHydraulics } from "./hydraulics";
import { computeElectrical } from "./electrical";
import {
  AC_DEPTH_MM,
  AC_WIDTH_MM,
  CHAIR_SIZE_MM,
  COUNTER_DEPTH_MM,
  COUNTER_WIDTH_MM,
  DOOR_WIDTH_MM,
  DRYWALL_THICKNESS_MM,
  FURNITURE_CIRCULATION_GAP_MM,
  FURNITURE_MARGIN_MM,
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  PREMIUM_MIN_AREA_MM2,
  PUFS_SIZE_MM,
  TABLE_DEPTH_MM,
  TABLE_WIDTH_MM,
  TECH_AREA_DEFAULT_MM,
  TECH_DOOR_WIDTH_MM,
  TOTEM_SIZE_MM,
  TOTEM_WALL_MM,
  concreteBaseMm,
} from "./constants";
import type {
  CatalogMachine,
  DrywallOpening,
  FurnitureLayout,
  Layout,
  LayoutResult,
  PremiumLayout,
  PlacedMachine,
  ProjectState,
  Rect,
  WallSide,
} from "./types";

// Todo o motor pensa em dois eixos abstratos:
//   "along"  = eixo em que a fileira de máquinas corre (contra a parede dela)
//   "across" = eixo perpendicular, da parede da fileira até a parede da frente
// Em orientation="back" (padrão), along=X e across=Y, exatamente como antes.
// Em orientation="side", along=Y e across=X — a planta inteira gira 90°; com
// machineWall="right" o across ainda é espelhado (conta a partir da parede
// direita da planta).
// Os helpers abaixo são o ÚNICO lugar que sabe fazer essa troca; todo o
// resto do arquivo só lida com (along, across), nunca com x/y diretamente.

function isMirrored(state: ProjectState): boolean {
  return state.orientation === "side" && state.machineWall === "right";
}

// Retângulo "espacial": width e height são as duas extensões reais no plano
// (uma ao longo da parede, outra entrando sala adentro) — então as DUAS
// trocam de eixo junto com x/y. Usado pra tudo que tem forma real: máquina,
// mesa, cadeiras, totem, ar-condicionado, corredor técnico.
function orientedRect(
  state: ProjectState,
  alongPos: number,
  acrossPos: number,
  alongExtent: number,
  acrossExtent: number
): Rect {
  if (state.orientation !== "side") {
    return { x: alongPos, y: acrossPos, width: alongExtent, height: acrossExtent };
  }
  const x = isMirrored(state) ? state.roomWidthMm - acrossPos - acrossExtent : acrossPos;
  return { x, y: alongPos, width: acrossExtent, height: alongExtent };
}

// Retângulo "marcador": `height` NÃO é uma extensão espacial de verdade —
// é a altura vertical da máquina (nos vãos do drywall) ou só 0 (nas portas,
// sinalizando "isto é uma abertura, não um objeto sólido"). Por isso nunca
// troca de eixo com `width`; só a posição (x/y) gira. Em "side", x é a
// posição da linha do drywall (já espelhada quando machineWall="right").
function orientedMarkerRect(
  state: ProjectState,
  alongPos: number,
  acrossPos: number,
  alongExtent: number,
  fixedHeight: number
): Rect {
  if (state.orientation !== "side") {
    return { x: alongPos, y: acrossPos, width: alongExtent, height: fixedHeight };
  }
  const x = isMirrored(state) ? state.roomWidthMm - acrossPos : acrossPos;
  return { x, y: alongPos, width: alongExtent, height: fixedHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function computeLayout(state: ProjectState, catalog: CatalogMachine[]): LayoutResult {
  const violations = validate(state, catalog);
  if (violations.length > 0) {
    return { layout: null, violations };
  }

  const alongLengthMm = state.orientation === "side" ? state.roomDepthMm : state.roomWidthMm;

  const resolved = resolveSelection(state.machines, catalog);
  const list = flattenSelection(resolved);

  const rowWidth = machineRowWidthMm(list);
  const startAlong =
    state.techAccessSide === "left"
      ? alongLengthMm - LATERAL_CLEARANCE_MM - rowWidth
      : LATERAL_CLEARANCE_MM;

  const maxDepthMm = Math.max(...list.map((m) => m.depthMm));
  const drywallAcross = TECH_AREA_DEFAULT_MM + maxDepthMm;

  let cursorAlong = startAlong;
  const alongStarts: number[] = [];
  const placed: PlacedMachine[] = [];
  const openings: DrywallOpening[] = [];
  list.forEach((m, i) => {
    const alongPos = cursorAlong;
    alongStarts.push(alongPos);
    // widthMm/depthMm aqui são SEMPRE "extensão em X" / "extensão em Y"
    // pros viewers — então trocam de eixo igual width/height de um rect.
    const r = orientedRect(state, alongPos, drywallAcross - m.depthMm, m.widthMm, m.depthMm);
    placed.push({
      catalogId: m.id,
      instanceIndex: i,
      x: r.x,
      y: r.y,
      widthMm: r.width,
      depthMm: r.height,
      heightMm: m.heightMm,
      baseMm: concreteBaseMm(m.weightKg),
    });
    openings.push(orientedMarkerRect(state, alongPos, drywallAcross, m.widthMm, m.heightMm));
    cursorAlong += m.widthMm + MACHINE_GAP_MM;
  });

  const corridorAlong =
    state.techAccessSide === "left" ? 0 : alongLengthMm - TECH_DOOR_WIDTH_MM;
  const techCorridor: Rect = orientedRect(state, corridorAlong, 0, TECH_DOOR_WIDTH_MM, drywallAcross);
  const techDoor: Rect = orientedMarkerRect(
    state,
    corridorAlong,
    drywallAcross,
    TECH_DOOR_WIDTH_MM,
    0
  );

  const dryerCount = countDryers(resolved);
  // BTU só pela área social (salão): a área técnica atrás do drywall não é
  // refrigerada.
  const acrossLengthMm = state.orientation === "side" ? state.roomWidthMm : state.roomDepthMm;
  const salonAcrossMm = acrossLengthMm - (drywallAcross + DRYWALL_THICKNESS_MM);
  const salonAreaM2 = (alongLengthMm / 1000) * (salonAcrossMm / 1000);
  const acSuggestedBTU = state.acOverrideBTU ?? suggestBTU(salonAreaM2, dryerCount);

  const frontDoor = state.doorEnabled ? frontDoorRect(state, drywallAcross) : null;
  const furniture = state.furnitureEnabled
    ? placeFurniture(
        state,
        drywallAcross,
        alongLengthMm,
        { start: startAlong, end: startAlong + rowWidth },
        { techCorridor, frontDoor }
      )
    : null;

  const layout: Layout = {
    orientation: state.orientation,
    machineWall: state.orientation === "side" ? state.machineWall : "left",
    machines: placed,
    drywall: { y: drywallAcross, openings, heightMm: state.ceilingHeightMm },
    techCorridor,
    techDoor,
    frontDoor,
    furniture,
    acSuggestedBTU,
    salonAreaM2,
    exhaust: computeExhaust({
      machines: list,
      alongStarts,
      drywallAcrossMm: drywallAcross,
      alongLengthMm,
      ceilingMm: state.ceilingHeightMm,
      techAccessSide: state.techAccessSide,
    }),
    hydraulics: computeHydraulics({
      machines: list,
      alongStarts,
      drywallAcrossMm: drywallAcross,
      alongLengthMm,
      ceilingMm: state.ceilingHeightMm,
      techAccessSide: state.techAccessSide,
    }),
    electrical: computeElectrical({
      machines: list,
      alongStarts,
      drywallAcrossMm: drywallAcross,
      ceilingMm: state.ceilingHeightMm,
      techAccessSide: state.techAccessSide,
      furniture,
      roomWidthMm: state.roomWidthMm,
    }),
    roomWidthMm: state.roomWidthMm,
    roomDepthMm: state.roomDepthMm,
    ceilingHeightMm: state.ceilingHeightMm,
  };

  return { layout, violations: [] };
}

// Porta de entrada: SEMPRE na fachada (parede de baixo da planta, y =
// roomDepthMm — um dos lados menores), centralizada, em qualquer orientação.
// Em orientation="side" a fachada também cruza a área técnica, então a porta
// é empurrada pra dentro do salão quando o centro cairia atrás do drywall.
function frontDoorRect(state: ProjectState, drywallAcross: number): Rect {
  const centered = state.roomWidthMm / 2 - DOOR_WIDTH_MM / 2;
  if (state.orientation !== "side") {
    return { x: centered, y: state.roomDepthMm, width: DOOR_WIDTH_MM, height: 0 };
  }
  const salonFront = drywallAcross + DRYWALL_THICKNESS_MM;
  const [minX, maxX] = isMirrored(state)
    ? [0, state.roomWidthMm - salonFront - DOOR_WIDTH_MM]
    : [salonFront, state.roomWidthMm - DOOR_WIDTH_MM];
  return { x: clamp(centered, minX, maxX), y: state.roomDepthMm, width: DOOR_WIDTH_MM, height: 0 };
}

// Posição ao longo da parede (along) da faixa de 50cm do totem, embutida no
// drywall. Quando o totem está do lado OPOSTO à porta técnica, usa o canto
// todo pra ele, colado na ponta da fileira (não disputa espaço com o
// corredor). Quando o usuário escolhe o MESMO lado da porta técnica, encosta
// logo antes do vão do corredor/porta, sem sobrepor — esse caso precisa de
// largura extra, cobrada em validate() (constraints.ts).
// Em orientation="side" o totem fica SEMPRE colado na fileira: antes da
// primeira máquina (totemSide="left", início do eixo along) ou depois da
// última (totemSide="right").
function totemWallAlong(
  state: ProjectState,
  alongLengthMm: number,
  row: { start: number; end: number }
): number {
  const side = state.totemSide;
  if (state.orientation === "side") {
    return side === "left" ? row.start - TOTEM_WALL_MM : row.end;
  }
  if (side !== state.techAccessSide) {
    return side === "left" ? 0 : alongLengthMm - TOTEM_WALL_MM;
  }
  return side === "left"
    ? TECH_DOOR_WIDTH_MM
    : alongLengthMm - TECH_DOOR_WIDTH_MM - TOTEM_WALL_MM;
}

const CHAIR_COUNT = 3;
const CHAIR_GROUP_MM = CHAIR_COUNT * CHAIR_SIZE_MM + (CHAIR_COUNT - 1) * FURNITURE_MARGIN_MM;

// Retângulo local, em (along, across) — só vira x/y no fim, via orientedRect.
interface LocalRect {
  a: number;
  c: number;
  la: number;
  lc: number;
}

// Fileira de cadeiras começando em (a, c), andando no eixo indicado.
function chairRow(a: number, c: number, axis: "along" | "across"): LocalRect[] {
  return Array.from({ length: CHAIR_COUNT }, (_, i) => {
    const step = i * (CHAIR_SIZE_MM + FURNITURE_MARGIN_MM);
    return axis === "along"
      ? { a: a + step, c, la: CHAIR_SIZE_MM, lc: CHAIR_SIZE_MM }
      : { a, c: c + step, la: CHAIR_SIZE_MM, lc: CHAIR_SIZE_MM };
  });
}

function overlaps(p: LocalRect, q: LocalRect): boolean {
  return p.a < q.a + q.la && q.a < p.a + p.la && p.c < q.c + q.lc && q.c < p.c + p.lc;
}

// Escolhe o primeiro arranjo de cadeiras que cabe inteiro no salão, sem
// encostar na mesa. Se nenhum couber, empurra o primeiro pra dentro do
// salão — nunca deixa cadeira pra fora da planta.
function pickChairs(
  candidates: LocalRect[][],
  table: LocalRect,
  alongLengthMm: number,
  acrossLengthMm: number,
  salonFrontAcross: number
): LocalRect[] {
  const fits = (r: LocalRect) =>
    r.a >= 0 &&
    r.a + r.la <= alongLengthMm &&
    r.c >= salonFrontAcross &&
    r.c + r.lc <= acrossLengthMm &&
    !overlaps(r, table);
  const ok = candidates.find((group) => group.every(fits));
  if (ok) return ok;

  const group = candidates[0];
  const minA = Math.min(...group.map((r) => r.a));
  const maxA = Math.max(...group.map((r) => r.a + r.la));
  const minC = Math.min(...group.map((r) => r.c));
  const maxC = Math.max(...group.map((r) => r.c + r.lc));
  const da = clamp(minA, 0, alongLengthMm - (maxA - minA)) - minA;
  const dc = clamp(minC, salonFrontAcross, acrossLengthMm - (maxC - minC)) - minC;
  return group.map((r) => ({ ...r, a: r.a + da, c: r.c + dc }));
}

// Trechos livres [from, to] do drywall (along), já descontando `clearance`
// de folga pra cada item ocupado (máquinas, totem, corredor) — as paredes
// das pontas não pedem folga.
function freeDrywallSegments(
  busy: { start: number; end: number }[],
  alongLengthMm: number,
  clearance: number
): { from: number; to: number }[] {
  const segments: { from: number; to: number }[] = [];
  let cursor = 0;
  const sorted = [...busy].sort((p, q) => p.start - q.start);
  for (const seg of [...sorted, { start: alongLengthMm, end: alongLengthMm }]) {
    const from = cursor === 0 ? 0 : cursor + clearance;
    const to = seg.start === alongLengthMm ? alongLengthMm : seg.start - clearance;
    if (to > from) segments.push({ from, to });
    cursor = Math.max(cursor, seg.end);
  }
  return segments;
}

// Início (along) de um trecho livre do drywall com `length` de comprimento,
// o mais perto possível de `target` (centro da fileira), ou null se não há.
function freeDrywallSpot(
  busy: { start: number; end: number }[],
  alongLengthMm: number,
  length: number,
  target: number
): number | null {
  let best: number | null = null;
  for (const { from, to } of freeDrywallSegments(busy, alongLengthMm, FURNITURE_MARGIN_MM)) {
    if (to - from < length) continue;
    // encosta no lado do trecho mais próximo da fileira
    const candidate = Math.abs(from - target) <= Math.abs(to - target) ? from : to - length;
    if (best === null || Math.abs(candidate - target) < Math.abs(best - target)) best = candidate;
  }
  return best;
}

// Folga mínima do ar-condicionado no drywall até máquinas, totem e porta
// técnica — não pode ficar em cima nem colado nelas.
const AC_MACHINE_CLEARANCE_MM = 600;

// Início (along) do AC no drywall, o mais perto possível de centralizar em
// `target`, respeitando AC_MACHINE_CLEARANCE_MM; null se não cabe.
function drywallAcAlong(
  busy: { start: number; end: number }[],
  alongLengthMm: number,
  target: number
): number | null {
  let best: number | null = null;
  for (const { from, to } of freeDrywallSegments(busy, alongLengthMm, AC_MACHINE_CLEARANCE_MM)) {
    if (to - from < AC_WIDTH_MM) continue;
    const a = clamp(target - AC_WIDTH_MM / 2, from, to - AC_WIDTH_MM);
    const dist = Math.abs(a + AC_WIDTH_MM / 2 - target);
    if (best === null || dist < Math.abs(best + AC_WIDTH_MM / 2 - target)) best = a;
  }
  return best;
}

interface PlacedFurniture {
  table: LocalRect;
  chairs: LocalRect[];
  chairsWall: WallSide;
  ac: LocalRect;
  acWall: WallSide;
}

function placeFurniture(
  state: ProjectState,
  drywallAcross: number,
  alongLengthMm: number,
  row: { start: number; end: number },
  room: { techCorridor: Rect; frontDoor: Rect | null }
): FurnitureLayout {
  const acrossLengthMm = state.orientation === "side" ? state.roomWidthMm : state.roomDepthMm;
  const zone = {
    alongLengthMm,
    acrossLengthMm,
    salonFrontAcross: drywallAcross + DRYWALL_THICKNESS_MM,
    // Distância da frente da máquina (linha do drywall) pra trânsito de pessoas.
    circulationAcross: drywallAcross + FURNITURE_CIRCULATION_GAP_MM,
  };

  // Totem: embutido no drywall, lado independente (totemSide).
  const totemAlong = totemWallAlong(state, alongLengthMm, row);
  const totem = orientedRect(
    state,
    totemAlong + (TOTEM_WALL_MM - TOTEM_SIZE_MM.width) / 2,
    drywallAcross,
    TOTEM_SIZE_MM.width,
    TOTEM_SIZE_MM.depth
  );

  // Trechos do drywall já ocupados (fileira, totem, corredor técnico) — o
  // que sobra é parede livre pra encostar cadeiras em "side"/"near".
  const corridorAlong = state.techAccessSide === "left" ? 0 : alongLengthMm - TECH_DOOR_WIDTH_MM;
  const drywallBusy = [
    { start: row.start, end: row.end },
    { start: totemAlong, end: totemAlong + TOTEM_WALL_MM },
    { start: corridorAlong, end: corridorAlong + TECH_DOOR_WIDTH_MM },
  ];

  const placed =
    state.orientation === "side"
      ? placeSideFurniture(state, zone, row, drywallBusy)
      : placeBackFurniture(state, zone);

  const toRect = (r: LocalRect) => orientedRect(state, r.a, r.c, r.la, r.lc);
  const table = toRect(placed.table);
  const poufs = placed.chairs.map(toRect);
  return {
    table,
    poufs,
    chairsWall: placed.chairsWall,
    totem,
    ac: toRect(placed.ac),
    acWall: placed.acWall,
    premium: isPremium(state)
      ? placePremium(state, zone, row, {
          // O que o balcão não pode pisar (a folga de trânsito entra em fits()).
          obstacles: [table, ...poufs, totem, room.techCorridor],
          frontDoor: room.frontDoor,
        })
      : null,
  };
}

export function isPremium(state: ProjectState): boolean {
  return state.roomWidthMm * state.roomDepthMm >= PREMIUM_MIN_AREA_MM2;
}

const COUNTER_CLEARANCE_MM = 300; // trânsito em volta do balcão
const PUFS_CLEARANCE_MM = 150; // pufs são baixos e macios: folga menor que a do balcão
const COUNTER_DOOR_CLEARANCE = { half: 700, depth: 1400 }; // vão livre na entrada
const COUNTER_SCAN_STEP_MM = 100;

function rectsOverlap(a: Rect, b: Rect, pad: number): boolean {
  return (
    a.x < b.x + b.width + pad &&
    a.x + a.width + pad > b.x &&
    a.y < b.y + b.height + pad &&
    a.y + a.height + pad > b.y
  );
}

// Balcão premium com banquetas, lado independente (counterSide em "back",
// counterSlot em "side"). Encosta numa parede e anda ao longo dela até achar
// um trecho livre — primeiro pelo lado escolhido, depois pelos outros, pra
// ele nunca sumir da loja premium. null só se não houver lugar nenhum.
function placePremium(
  state: ProjectState,
  zone: FurnitureZone,
  row: { start: number; end: number },
  ctx: { obstacles: Rect[]; frontDoor: Rect | null }
): PremiumLayout {
  const { alongLengthMm, acrossLengthMm, circulationAcross } = zone;
  const rowCenter = (row.start + row.end) / 2;
  const L = COUNTER_WIDTH_MM;
  const D = COUNTER_DEPTH_MM;
  const range = (from: number, to: number) => {
    const step = Math.sign(to - from) * COUNTER_SCAN_STEP_MM;
    const out: number[] = [];
    for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v);
    return out;
  };

  interface Candidate {
    rect: Rect;
    wall: WallSide;
  }
  const candidates: Candidate[] = [];
  const addAlongWall = (wall: WallSide, acrossPos: number, alongStarts: number[]) => {
    for (const a of alongStarts) {
      candidates.push({ rect: orientedRect(state, a, acrossPos, L, D), wall });
    }
  };

  if (state.orientation === "side") {
    const farWall: WallSide = state.machineWall === "left" ? "right" : "left";
    const nearWall: WallSide = state.machineWall;
    const farAcross = acrossLengthMm - D;
    const maxA = alongLengthMm - L;
    const farTop = () => addAlongWall(farWall, farAcross, range(0, maxA));
    const farBottom = () => addAlongWall(farWall, farAcross, range(maxA, 0));
    const near = () => {
      const center = Math.min(Math.max(rowCenter - L / 2, 0), maxA);
      const starts = range(0, maxA).sort((p, q) => Math.abs(p - center) - Math.abs(q - center));
      addAlongWall(nearWall, circulationAcross, starts);
    };
    const order = {
      farTop: [farTop, farBottom, near],
      farBottom: [farBottom, farTop, near],
      near: [near, farBottom, farTop],
    }[state.counterSlot];
    order.forEach((add) => add());
  } else {
    const startAcross = circulationAcross + FURNITURE_MARGIN_MM;
    const lastAcross = acrossLengthMm - L;
    const sides: ("left" | "right")[] =
      state.counterSide === "left" ? ["left", "right"] : ["right", "left"];
    for (const side of sides) {
      const a = side === "left" ? 0 : alongLengthMm - D;
      for (const c of range(startAcross, lastAcross)) {
        candidates.push({ rect: orientedRect(state, a, c, D, L), wall: side });
      }
    }
  }

  const door = ctx.frontDoor;
  const doorZone: Rect | null = door
    ? {
        x: door.x + door.width / 2 - COUNTER_DOOR_CLEARANCE.half,
        y: state.roomDepthMm - COUNTER_DOOR_CLEARANCE.depth,
        width: COUNTER_DOOR_CLEARANCE.half * 2,
        height: COUNTER_DOOR_CLEARANCE.depth,
      }
    : null;
  const fits = (r: Rect, pad = COUNTER_CLEARANCE_MM) =>
    r.x >= 0 &&
    r.y >= 0 &&
    r.x + r.width <= state.roomWidthMm &&
    r.y + r.height <= state.roomDepthMm &&
    !ctx.obstacles.some((o) => rectsOverlap(r, o, pad)) &&
    !(doorZone && rectsOverlap(r, doorZone, 0));

  const hit = candidates.find((c) => fits(c.rect));
  if (hit) ctx.obstacles.push(hit.rect);

  // Pufs: o mais perto possível do centro do salão (em coordenadas locais, a
  // partir da folga de trânsito das máquinas até a faixa da entrada).
  const S = PUFS_SIZE_MM;
  const center = { a: alongLengthMm / 2, c: (circulationAcross + acrossLengthMm) / 2 };
  const spots: Rect[] = [];
  for (let a = 0; a + S <= alongLengthMm; a += COUNTER_SCAN_STEP_MM) {
    for (let c = circulationAcross; c + S <= acrossLengthMm; c += COUNTER_SCAN_STEP_MM) {
      spots.push(orientedRect(state, a, c, S, S));
    }
  }
  const centerRect = orientedRect(state, center.a - S / 2, center.c - S / 2, S, S);
  const dist = (r: Rect) => Math.hypot(r.x - centerRect.x, r.y - centerRect.y);
  const pufs = spots.sort((p, q) => dist(p) - dist(q)).find((r) => fits(r, PUFS_CLEARANCE_MM)) ?? null;

  return { counter: hit?.rect ?? null, counterWall: hit?.wall ?? "left", pufs };
}

interface FurnitureZone {
  alongLengthMm: number;
  acrossLengthMm: number;
  salonFrontAcross: number;
  circulationAcross: number;
}

// orientation="back": mesa, cadeiras e AC encostados numa das paredes
// laterais (tableSide/chairsSide/acSide), a 1,00m da frente das máquinas.
function placeBackFurniture(state: ProjectState, zone: FurnitureZone): PlacedFurniture {
  const { alongLengthMm, acrossLengthMm, salonFrontAcross, circulationAcross } = zone;
  const gap = FURNITURE_MARGIN_MM;

  const table: LocalRect = {
    a: state.tableSide === "left" ? 0 : alongLengthMm - TABLE_WIDTH_MM,
    c: circulationAcross,
    la: TABLE_WIDTH_MM,
    lc: TABLE_DEPTH_MM,
  };

  // Cadeiras: se caírem do mesmo lado da mesa, continuam a coluna logo
  // depois dela; senão, começam na mesma distância de trânsito. Quando a
  // coluna não cabe até a parede da frente, viram fileira ao lado da mesa.
  const sameSide = state.chairsSide === state.tableSide;
  const wallAlong = state.chairsSide === "left" ? 0 : alongLengthMm - CHAIR_SIZE_MM;
  const besideAlong = sameSide
    ? state.chairsSide === "left"
      ? TABLE_WIDTH_MM + gap
      : alongLengthMm - TABLE_WIDTH_MM - gap - CHAIR_GROUP_MM
    : state.chairsSide === "left"
      ? 0
      : alongLengthMm - CHAIR_GROUP_MM;
  const chairs = pickChairs(
    [
      chairRow(wallAlong, sameSide ? table.c + TABLE_DEPTH_MM + gap : circulationAcross, "across"),
      chairRow(besideAlong, circulationAcross, "along"),
    ],
    table,
    alongLengthMm,
    acrossLengthMm,
    salonFrontAcross
  );

  // Ar-condicionado: lado independente (acSide), no meio do salão.
  const salonCenterAcross = (salonFrontAcross + acrossLengthMm) / 2;
  const ac: LocalRect = {
    a: state.acSide === "left" ? 0 : alongLengthMm - AC_DEPTH_MM,
    c: salonCenterAcross - AC_WIDTH_MM / 2,
    la: AC_DEPTH_MM,
    lc: AC_WIDTH_MM,
  };

  // Coluna encostada na parede lateral; fileira ao lado da mesa fica de
  // costas pras máquinas (parede de cima, em "back").
  const chairsWall: WallSide = chairs[0].a === chairs[1].a ? state.chairsSide : "top";
  return { table, chairs, chairsWall, ac, acWall: state.acSide };
}

// orientation="side": cada item vai pra um dos 3 encaixes (SideSlot):
//   near      → em frente às máquinas, a 1,00m delas, centralizado na fileira
//   farTop    → na parede oposta às máquinas, metade de cima da planta
//   farBottom → na parede oposta às máquinas, metade de baixo da planta
function placeSideFurniture(
  state: ProjectState,
  zone: FurnitureZone,
  row: { start: number; end: number },
  drywallBusy: { start: number; end: number }[]
): PlacedFurniture {
  const { alongLengthMm, acrossLengthMm, salonFrontAcross, circulationAcross } = zone;
  const gap = FURNITURE_MARGIN_MM;
  const rowCenter = (row.start + row.end) / 2;

  const tableAlong = {
    near: clamp(rowCenter - TABLE_WIDTH_MM / 2, 0, alongLengthMm - TABLE_WIDTH_MM),
    farTop: 0,
    farBottom: alongLengthMm - TABLE_WIDTH_MM,
  }[state.tableSlot];
  const table: LocalRect = {
    a: tableAlong,
    c: state.tableSlot === "near" ? circulationAcross : acrossLengthMm - TABLE_DEPTH_MM,
    la: TABLE_WIDTH_MM,
    lc: TABLE_DEPTH_MM,
  };

  // Cadeiras "near": SEMPRE encostadas numa parede — no trecho livre do
  // drywall mais perto da fileira (ao lado das máquinas/totem); sem trecho
  // livre que caiba as 3, vão pra parede de topo do lado oposto ao corredor
  // técnico. "far": fileira na parede oposta; se dividem o encaixe com a
  // mesa, ficam logo depois dela (ou antes, se não couber).
  let chairs: LocalRect[];
  let nearChairsOnEndWall = false;
  let endWall: WallSide = "top";
  if (state.chairsSlot === "near") {
    const spot = freeDrywallSpot(drywallBusy, alongLengthMm, CHAIR_GROUP_MM, rowCenter);
    if (spot !== null) {
      chairs = chairRow(spot, salonFrontAcross, "along");
    } else {
      nearChairsOnEndWall = true;
      const endA = state.techAccessSide === "left" ? alongLengthMm - CHAIR_SIZE_MM : 0;
      endWall = endA === 0 ? "top" : "bottom";
      chairs = pickChairs(
        [chairRow(endA, salonFrontAcross + gap, "across")],
        table,
        alongLengthMm,
        acrossLengthMm,
        salonFrontAcross
      );
    }
  } else {
    const sameSlot = state.chairsSlot === state.tableSlot;
    const afterTable = table.a + TABLE_WIDTH_MM + gap;
    const beforeTable = table.a - gap - CHAIR_GROUP_MM;
    const top = state.chairsSlot === "farTop";
    const chairAlongs = sameSlot
      ? top
        ? [afterTable, beforeTable]
        : [beforeTable, afterTable]
      : [top ? 0 : alongLengthMm - CHAIR_GROUP_MM];
    chairs = pickChairs(
      chairAlongs.map((a) => chairRow(a, acrossLengthMm - CHAIR_SIZE_MM, "along")),
      table,
      alongLengthMm,
      acrossLengthMm,
      salonFrontAcross
    );
  }

  const farWall: WallSide = state.machineWall === "left" ? "right" : "left";
  const nearWall: WallSide = state.machineWall;
  const chairsWall: WallSide =
    state.chairsSlot !== "near" ? farWall : nearChairsOnEndWall ? endWall : nearWall;

  // AC na parede de topo do lado oposto ao corredor técnico, no meio do salão.
  const endWallAc = (): { ac: LocalRect; wall: WallSide } => {
    const atStart = state.techAccessSide !== "left";
    const center = (salonFrontAcross + acrossLengthMm) / 2;
    return {
      ac: {
        a: atStart ? 0 : alongLengthMm - AC_DEPTH_MM,
        c: clamp(center - AC_WIDTH_MM / 2, salonFrontAcross, acrossLengthMm - AC_WIDTH_MM),
        la: AC_DEPTH_MM,
        lc: AC_WIDTH_MM,
      },
      wall: atStart ? "top" : "bottom",
    };
  };
  const drywallAc = (centerAlong: number): LocalRect => ({
    a: clamp(centerAlong - AC_WIDTH_MM / 2, 0, alongLengthMm - AC_WIDTH_MM),
    c: salonFrontAcross,
    la: AC_WIDTH_MM,
    lc: AC_DEPTH_MM,
  });

  // Ar-condicionado: NUNCA em cima das máquinas (nem do totem/porta técnica).
  //   far  → parede oposta, no meio da metade de cima/baixo da planta
  //   near → junto das cadeiras "near" (em cima delas, na mesma parede);
  //          sem cadeiras ali, no trecho livre do drywall mais perto da
  //          fileira; sem trecho livre, na parede de topo.
  let ac: LocalRect;
  let acWall: WallSide;
  if (state.acSlot !== "near") {
    const center = state.acSlot === "farTop" ? alongLengthMm / 4 : (alongLengthMm * 3) / 4;
    ac = {
      a: clamp(center - AC_WIDTH_MM / 2, 0, alongLengthMm - AC_WIDTH_MM),
      c: acrossLengthMm - AC_DEPTH_MM,
      la: AC_WIDTH_MM,
      lc: AC_DEPTH_MM,
    };
    acWall = farWall;
  } else if (state.chairsSlot === "near" && nearChairsOnEndWall) {
    const first = chairs[0];
    const last = chairs[chairs.length - 1];
    const center = (first.c + last.c + last.lc) / 2;
    ac = {
      a: first.a === 0 ? 0 : alongLengthMm - AC_DEPTH_MM,
      c: clamp(center - AC_WIDTH_MM / 2, salonFrontAcross, acrossLengthMm - AC_WIDTH_MM),
      la: AC_DEPTH_MM,
      lc: AC_WIDTH_MM,
    };
    acWall = endWall;
  } else if (state.chairsSlot === "near") {
    // Em cima das cadeiras, mas a ≥60cm das máquinas/totem/porta técnica
    // (se o trecho for curto demais pra essa folga, fica centrado nelas).
    const chairsCenter = (chairs[0].a + chairs[chairs.length - 1].a + CHAIR_SIZE_MM) / 2;
    const a = drywallAcAlong(drywallBusy, alongLengthMm, chairsCenter);
    ac = drywallAc(a === null ? chairsCenter : a + AC_WIDTH_MM / 2);
    acWall = nearWall;
  } else {
    const a = drywallAcAlong(drywallBusy, alongLengthMm, rowCenter);
    if (a !== null) {
      ac = drywallAc(a + AC_WIDTH_MM / 2);
      acWall = nearWall;
    } else {
      ({ ac, wall: acWall } = endWallAc());
    }
  }

  return { table, chairs, chairsWall, ac, acWall };
}
