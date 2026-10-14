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

export function computeLayout(state: ProjectState, catalog: CatalogMachine[]): LayoutResult {
  const violations = validate(state, catalog);
  if (violations.length > 0) {
    return { layout: null, violations };
  }

  const resolved = resolveSelection(state.machines, catalog);
  const list = flattenSelection(resolved);

  const rowWidth = machineRowWidthMm(list);
  const startX =
    state.techAccessSide === "left"
      ? state.roomWidthMm - LATERAL_CLEARANCE_MM - rowWidth
      : LATERAL_CLEARANCE_MM;

  const maxDepthMm = Math.max(...list.map((m) => m.depthMm));
  const drywallY = TECH_AREA_DEFAULT_MM + maxDepthMm;

  let cursorX = startX;
  const placed: PlacedMachine[] = list.map((m, i) => {
    const p: PlacedMachine = {
      catalogId: m.id,
      instanceIndex: i,
      x: cursorX,
      y: drywallY - m.depthMm,
      widthMm: m.widthMm,
      depthMm: m.depthMm,
      heightMm: m.heightMm,
    };
    cursorX += m.widthMm + MACHINE_GAP_MM;
    return p;
  });

  const openings: DrywallOpening[] = placed.map((p) => ({
    x: p.x,
    y: drywallY,
    width: p.widthMm,
    height: p.heightMm,
  }));

  const corridorX = state.techAccessSide === "left" ? 0 : state.roomWidthMm - TECH_DOOR_WIDTH_MM;
  const techCorridor: Rect = { x: corridorX, y: 0, width: TECH_DOOR_WIDTH_MM, height: drywallY };
  const techDoor: Rect = { x: corridorX, y: drywallY, width: TECH_DOOR_WIDTH_MM, height: 0 };

  const dryerCount = countDryers(resolved);
  const areaM2 = (state.roomWidthMm / 1000) * (state.roomDepthMm / 1000);
  const acSuggestedBTU = state.acOverrideBTU ?? suggestBTU(areaM2, dryerCount);

  const furniture = state.furnitureEnabled ? placeFurniture(state, drywallY) : null;

  const frontDoor: Rect | null = state.doorEnabled
    ? { x: state.roomWidthMm / 2 - DOOR_WIDTH_MM / 2, y: state.roomDepthMm, width: DOOR_WIDTH_MM, height: 0 }
    : null;

  const layout: Layout = {
    machines: placed,
    drywall: { y: drywallY, openings, heightMm: state.ceilingHeightMm },
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

// Posição X da faixa de 50cm do totem, embutida no drywall. Quando o totem
// está do lado OPOSTO à porta técnica, usa o canto todo pra ele (não disputa
// espaço com o corredor). Quando o usuário escolhe o MESMO lado da porta
// técnica, encosta logo antes do vão do corredor/porta, sem sobrepor —
// esse caso precisa de largura extra, cobrada em validate() (constraints.ts).
function totemWallX(state: ProjectState): number {
  const side = state.totemSide;
  if (side !== state.techAccessSide) {
    return side === "left" ? 0 : state.roomWidthMm - TOTEM_WALL_MM;
  }
  return side === "left"
    ? TECH_DOOR_WIDTH_MM
    : state.roomWidthMm - TECH_DOOR_WIDTH_MM - TOTEM_WALL_MM;
}

const CHAIR_COUNT = 3;

function placeFurniture(state: ProjectState, drywallY: number): FurnitureLayout {
  const salonFrontY = drywallY + DRYWALL_THICKNESS_MM;
  const gap = FURNITURE_MARGIN_MM;

  // Totem: embutido no drywall, lado independente (totemSide).
  const totem: Rect = {
    x: totemWallX(state) + (TOTEM_WALL_MM - TOTEM_SIZE_MM.width) / 2,
    y: drywallY,
    width: TOTEM_SIZE_MM.width,
    height: TOTEM_SIZE_MM.depth,
  };

  // Mesa: virada (2m de comprimento entrando sala adentro, perpendicular à
  // parede), a 1,00m da frente da máquina (linha do drywall) pra trânsito
  // de pessoas. Lado independente (tableSide).
  const table: Rect = {
    x: state.tableSide === "left" ? 0 : state.roomWidthMm - TABLE_WIDTH_MM,
    y: drywallY + FURNITURE_CIRCULATION_GAP_MM,
    width: TABLE_WIDTH_MM,
    height: TABLE_DEPTH_MM,
  };

  // Cadeiras: lado independente (chairsSide). Se caírem do mesmo lado da
  // mesa, continuam a fileira logo depois dela; senão, começam do zero na
  // mesma distância de trânsito (1,00m da máquina), no seu próprio lado.
  const chairX = state.chairsSide === "left" ? 0 : state.roomWidthMm - CHAIR_SIZE_MM;
  const chairsStartY =
    state.chairsSide === state.tableSide
      ? table.y + table.height + gap
      : drywallY + FURNITURE_CIRCULATION_GAP_MM;
  const poufs: Rect[] = Array.from({ length: CHAIR_COUNT }, (_, i) => ({
    x: chairX,
    y: chairsStartY + i * (CHAIR_SIZE_MM + gap),
    width: CHAIR_SIZE_MM,
    height: CHAIR_SIZE_MM,
  }));

  // Ar-condicionado: lado independente (acSide), no meio do salão.
  const salonCenterY = (salonFrontY + state.roomDepthMm) / 2;
  const ac: Rect = {
    x: state.acSide === "left" ? 0 : state.roomWidthMm - AC_DEPTH_MM,
    y: salonCenterY - AC_WIDTH_MM / 2,
    width: AC_DEPTH_MM,
    height: AC_WIDTH_MM,
  };

  return { table, poufs, totem, ac, acWall: state.acSide };
}
