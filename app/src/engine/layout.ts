import {
  countDryers,
  flattenSelection,
  machineRowWidthMm,
  resolveSelection,
  validate,
} from "./constraints";
import { suggestBTU } from "./btu";
import {
  DOOR_WIDTH_MM,
  DRYWALL_THICKNESS_MM,
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  TECH_AREA_DEFAULT_MM,
  TOTEM_SIZE_MM,
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

  const corridorX = state.techAccessSide === "left" ? 0 : state.roomWidthMm - LATERAL_CLEARANCE_MM;
  const techCorridor: Rect = { x: corridorX, y: 0, width: LATERAL_CLEARANCE_MM, height: drywallY };

  const dryerCount = countDryers(resolved);
  const areaM2 = (state.roomWidthMm / 1000) * (state.roomDepthMm / 1000);
  const acSuggestedBTU = state.acOverrideBTU ?? suggestBTU(areaM2, dryerCount);

  const furniture = state.furnitureEnabled
    ? placeFurniture(state, drywallY, corridorX)
    : null;

  const frontDoor: Rect | null = state.doorEnabled
    ? { x: state.roomWidthMm / 2 - DOOR_WIDTH_MM / 2, y: state.roomDepthMm, width: DOOR_WIDTH_MM, height: 0 }
    : null;

  const layout: Layout = {
    machines: placed,
    drywall: { y: drywallY, openings, heightMm: maxHeightMm + 200 },
    techCorridor,
    frontDoor,
    furniture,
    acSuggestedBTU,
    roomWidthMm: state.roomWidthMm,
    roomDepthMm: state.roomDepthMm,
    ceilingHeightMm: state.ceilingHeightMm,
  };

  return { layout, violations: [] };
}

function placeFurniture(state: ProjectState, drywallY: number, corridorX: number): FurnitureLayout {
  const salonFrontY = drywallY + DRYWALL_THICKNESS_MM;

  const totem: Rect = {
    x: corridorX + (LATERAL_CLEARANCE_MM - TOTEM_SIZE_MM.width) / 2,
    y: salonFrontY,
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

  const chairSize = 400;
  const chairs: Rect[] = [
    {
      x: table.x - chairSize - 50,
      y: table.y + tableDepth / 2 - chairSize / 2,
      width: chairSize,
      height: chairSize,
    },
    {
      x: table.x + tableWidth + 50,
      y: table.y + tableDepth / 2 - chairSize / 2,
      width: chairSize,
      height: chairSize,
    },
    {
      x: table.x + tableWidth / 2 - chairSize / 2,
      y: table.y + tableDepth + 50,
      width: chairSize,
      height: chairSize,
    },
  ];

  const acWidth = 900;
  const ac: Rect = { x: state.roomWidthMm / 2 - acWidth / 2, y: 0, width: acWidth, height: 200 };

  return { table, chairs, totem, ac };
}
