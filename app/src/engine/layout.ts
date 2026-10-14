import {
  countDryers,
  flattenSelection,
  machineRowWidthMm,
  resolveSelection,
  validate,
} from "./constraints";
import { suggestBTU } from "./btu";
import {
  AC_DEPTH_MM,
  AC_WIDTH_MM,
  CHAIR_SIZE_MM,
  DOOR_WIDTH_MM,
  DRYWALL_THICKNESS_MM,
  FURNITURE_CIRCULATION_GAP_MM,
  FURNITURE_MARGIN_MM,
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  TABLE_DEPTH_MM,
  TABLE_WIDTH_MM,
  TECH_AREA_DEFAULT_MM,
  TECH_DOOR_WIDTH_MM,
  TOTEM_SIZE_MM,
  TOTEM_WALL_MM,
} from "./constants";
import type {
  CatalogMachine,
  DrywallOpening,
  FurnitureLayout,
  Layout,
  LayoutResult,
  PlacedMachine,
  ProjectState,
  Rect,
} from "./types";

// Todo o motor pensa em dois eixos abstratos:
//   "along"  = eixo em que a fileira de máquinas corre (contra a parede dela)
//   "across" = eixo perpendicular, da parede da fileira até a parede da frente
// Em orientation="back" (padrão), along=X e across=Y, exatamente como antes.
// Em orientation="side", along=Y e across=X — a planta inteira gira 90°.
// Os dois helpers abaixo são o ÚNICO lugar que sabe fazer essa troca; todo o
// resto do arquivo só lida com (along, across), nunca com x/y diretamente.

function toXY(state: ProjectState, along: number, across: number): { x: number; y: number } {
  return state.orientation === "side" ? { x: across, y: along } : { x: along, y: across };
}

// Retângulo "espacial": width e height são as duas extensões reais no plano
// (uma ao longo da parede, outra entrando sala adentro) — então as DUAS
// trocam de eixo junto com x/y. Usado pra tudo que tem forma real: mesa,
// cadeiras, totem, ar-condicionado, corredor técnico.
function orientedRect(
  state: ProjectState,
  alongPos: number,
  acrossPos: number,
  alongExtent: number,
  acrossExtent: number
): Rect {
  const { x, y } = toXY(state, alongPos, acrossPos);
  return state.orientation === "side"
    ? { x, y, width: acrossExtent, height: alongExtent }
    : { x, y, width: alongExtent, height: acrossExtent };
}

// Retângulo "marcador": `height` NÃO é uma extensão espacial de verdade —
// é a altura vertical da máquina (nos vãos do drywall) ou só 0 (nas portas,
// sinalizando "isto é uma abertura, não um objeto sólido"). Por isso nunca
// troca de eixo com `width`; só a posição (x/y) gira.
function orientedMarkerRect(
  state: ProjectState,
  alongPos: number,
  acrossPos: number,
  alongExtent: number,
  fixedHeight: number
): Rect {
  const { x, y } = toXY(state, alongPos, acrossPos);
  return { x, y, width: alongExtent, height: fixedHeight };
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
  const placed: PlacedMachine[] = [];
  const openings: DrywallOpening[] = [];
  list.forEach((m, i) => {
    const alongPos = cursorAlong;
    const { x, y } = toXY(state, alongPos, drywallAcross - m.depthMm);
    placed.push({
      catalogId: m.id,
      instanceIndex: i,
      x,
      y,
      // widthMm/depthMm aqui são SEMPRE "extensão em X" / "extensão em Y"
      // pros viewers — então trocam de eixo igual width/height de um rect.
      widthMm: state.orientation === "side" ? m.depthMm : m.widthMm,
      depthMm: state.orientation === "side" ? m.widthMm : m.depthMm,
      heightMm: m.heightMm,
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
  const areaM2 = (state.roomWidthMm / 1000) * (state.roomDepthMm / 1000);
  const acSuggestedBTU = state.acOverrideBTU ?? suggestBTU(areaM2, dryerCount);

  const furniture = state.furnitureEnabled
    ? placeFurniture(state, drywallAcross, alongLengthMm)
    : null;

  const frontDoor: Rect | null = state.doorEnabled
    ? orientedMarkerRect(
        state,
        alongLengthMm / 2 - DOOR_WIDTH_MM / 2,
        state.orientation === "side" ? state.roomWidthMm : state.roomDepthMm,
        DOOR_WIDTH_MM,
        0
      )
    : null;

  const layout: Layout = {
    orientation: state.orientation,
    machines: placed,
    drywall: { y: drywallAcross, openings, heightMm: state.ceilingHeightMm },
    techCorridor,
    techDoor,
    frontDoor,
    furniture,
    acSuggestedBTU,
    roomWidthMm: state.roomWidthMm,
    roomDepthMm: state.roomDepthMm,
    ceilingHeightMm: state.ceilingHeightMm,
  };

  return { layout, violations: [] };
}

// Posição ao longo da parede (along) da faixa de 50cm do totem, embutida no
// drywall. Quando o totem está do lado OPOSTO à porta técnica, usa o canto
// todo pra ele (não disputa espaço com o corredor). Quando o usuário escolhe
// o MESMO lado da porta técnica, encosta logo antes do vão do corredor/porta,
// sem sobrepor — esse caso precisa de largura extra, cobrada em validate()
// (constraints.ts).
function totemWallAlong(state: ProjectState, alongLengthMm: number): number {
  const side = state.totemSide;
  if (side !== state.techAccessSide) {
    return side === "left" ? 0 : alongLengthMm - TOTEM_WALL_MM;
  }
  return side === "left"
    ? TECH_DOOR_WIDTH_MM
    : alongLengthMm - TECH_DOOR_WIDTH_MM - TOTEM_WALL_MM;
}

const CHAIR_COUNT = 3;

function placeFurniture(
  state: ProjectState,
  drywallAcross: number,
  alongLengthMm: number
): FurnitureLayout {
  const salonFrontAcross = drywallAcross + DRYWALL_THICKNESS_MM;
  const gap = FURNITURE_MARGIN_MM;

  // Totem: embutido no drywall, lado independente (totemSide).
  const totem = orientedRect(
    state,
    totemWallAlong(state, alongLengthMm) + (TOTEM_WALL_MM - TOTEM_SIZE_MM.width) / 2,
    drywallAcross,
    TOTEM_SIZE_MM.width,
    TOTEM_SIZE_MM.depth
  );

  // Mesa: virada (2m de comprimento entrando sala adentro, perpendicular à
  // parede), a 1,00m da frente da máquina (linha do drywall) pra trânsito
  // de pessoas. Lado independente (tableSide).
  const tableAlong = state.tableSide === "left" ? 0 : alongLengthMm - TABLE_WIDTH_MM;
  const tableAcross = drywallAcross + FURNITURE_CIRCULATION_GAP_MM;
  const table = orientedRect(state, tableAlong, tableAcross, TABLE_WIDTH_MM, TABLE_DEPTH_MM);

  // Cadeiras: lado independente (chairsSide). Se caírem do mesmo lado da
  // mesa, continuam a fileira logo depois dela; senão, começam do zero na
  // mesma distância de trânsito (1,00m da máquina), no seu próprio lado.
  const chairAlong = state.chairsSide === "left" ? 0 : alongLengthMm - CHAIR_SIZE_MM;
  const chairsStartAcross =
    state.chairsSide === state.tableSide
      ? tableAcross + TABLE_DEPTH_MM + gap
      : drywallAcross + FURNITURE_CIRCULATION_GAP_MM;
  const poufs: Rect[] = Array.from({ length: CHAIR_COUNT }, (_, i) =>
    orientedRect(
      state,
      chairAlong,
      chairsStartAcross + i * (CHAIR_SIZE_MM + gap),
      CHAIR_SIZE_MM,
      CHAIR_SIZE_MM
    )
  );

  // Ar-condicionado: lado independente (acSide), no meio do salão.
  const roomDepthForCenter = state.orientation === "side" ? state.roomWidthMm : state.roomDepthMm;
  const salonCenterAcross = (salonFrontAcross + roomDepthForCenter) / 2;
  const acAlong = state.acSide === "left" ? 0 : alongLengthMm - AC_DEPTH_MM;
  const ac = orientedRect(
    state,
    acAlong,
    salonCenterAcross - AC_WIDTH_MM / 2,
    AC_DEPTH_MM,
    AC_WIDTH_MM
  );

  return { table, poufs, totem, ac, acWall: state.acSide };
}
