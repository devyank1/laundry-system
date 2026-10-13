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
  DOOR_WIDTH_MM,
  DRYWALL_THICKNESS_MM,
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  POUF_DIAMETER_MM,
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
  const maxHeightMm = Math.max(...list.map((m) => m.heightMm));
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

  const furniture = state.furnitureEnabled
    ? placeFurniture(state, drywallY, startX, startX + rowWidth)
    : null;

  const frontDoor: Rect | null = state.doorEnabled
    ? { x: state.roomWidthMm / 2 - DOOR_WIDTH_MM / 2, y: state.roomDepthMm, width: DOOR_WIDTH_MM, height: 0 }
    : null;

  const layout: Layout = {
    machines: placed,
    drywall: { y: drywallY, openings, heightMm: maxHeightMm + 200 },
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

function placeFurniture(
  state: ProjectState,
  drywallY: number,
  rowStartX: number,
  rowEndX: number
): FurnitureLayout {
  const salonFrontY = drywallY + DRYWALL_THICKNESS_MM;
  // Ar-condicionado fica do lado oposto à porta técnica.
  const oppositeSide = state.techAccessSide === "left" ? "right" : "left";

  // Totem embutido no trecho de 50cm de drywall entre a última máquina e a porta técnica.
  const totemWallX = state.techAccessSide === "left" ? rowStartX - TOTEM_WALL_MM : rowEndX;
  const totem: Rect = {
    x: totemWallX + (TOTEM_WALL_MM - TOTEM_SIZE_MM.width) / 2,
    y: drywallY,
    width: TOTEM_SIZE_MM.width,
    height: TOTEM_SIZE_MM.depth,
  };

  const salonDepth = state.roomDepthMm - salonFrontY;
  const tableWidth = 900;
  const tableDepth = 700;
  const table: Rect = {
    x: state.roomWidthMm / 2 - tableWidth / 2,
    y: salonFrontY + salonDepth / 2 - tableDepth / 2,
    width: tableWidth,
    height: tableDepth,
  };

  const pouf = POUF_DIAMETER_MM;
  const poufs: Rect[] = [
    {
      x: table.x - pouf - 50,
      y: table.y + tableDepth / 2 - pouf / 2,
      width: pouf,
      height: pouf,
    },
    {
      x: table.x + tableWidth + 50,
      y: table.y + tableDepth / 2 - pouf / 2,
      width: pouf,
      height: pouf,
    },
    {
      x: table.x + tableWidth / 2 - pouf / 2,
      y: table.y + tableDepth + 50,
      width: pouf,
      height: pouf,
    },
  ];

  // Ar-condicionado na parede lateral, no meio do salão onde o cliente circula.
  const salonCenterY = (salonFrontY + state.roomDepthMm) / 2;
  const ac: Rect = {
    x: oppositeSide === "left" ? 0 : state.roomWidthMm - AC_DEPTH_MM,
    y: salonCenterY - AC_WIDTH_MM / 2,
    width: AC_DEPTH_MM,
    height: AC_WIDTH_MM,
  };

  return { table, poufs, totem, ac, acWall: oppositeSide };
}
