export type MachineType = "lavadora" | "secadora" | "stack";

export interface CatalogMachine {
  id: string;
  brand: string;
  model: string;
  type: MachineType;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  breakerLavadoraA?: number;
  breakerSecadoraA?: number;
  cableMm2?: string;
  exhaustDiameterMm?: number;
  drainInch?: string;
  drainLpm?: number;
  weightKg?: number;
}

export interface MachineSelection {
  catalogId: string;
  qty: number;
}

export type TechAccessSide = "left" | "right";

export interface ProjectState {
  roomWidthMm: number;
  roomDepthMm: number;
  ceilingHeightMm: number;
  machines: MachineSelection[];
  doorEnabled: boolean;
  techAccessSide: TechAccessSide;
  furnitureEnabled: boolean;
  acOverrideBTU: number | null;
}

export interface PlacedMachine {
  catalogId: string;
  instanceIndex: number;
  x: number;
  y: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DrywallOpening = Rect;

export interface FurnitureLayout {
  table: Rect;
  chairs: Rect[];
  totem: Rect;
  ac: Rect;
}

export interface Layout {
  machines: PlacedMachine[];
  drywall: { y: number; openings: DrywallOpening[]; heightMm: number };
  techCorridor: Rect;
  frontDoor: Rect | null;
  furniture: FurnitureLayout | null;
  acSuggestedBTU: number;
  roomWidthMm: number;
  roomDepthMm: number;
  ceilingHeightMm: number;
}

export type ViolationCode =
  | "NO_MACHINES"
  | "WIDTH_TOO_SMALL"
  | "DEPTH_TOO_SMALL"
  | "CEILING_TOO_LOW"
  | "FURNITURE_WIDTH_TOO_SMALL";

export interface Violation {
  code: ViolationCode;
  message: string;
  field: keyof ProjectState;
  suggestedValueMm: number;
}

export interface LayoutResult {
  layout: Layout | null;
  violations: Violation[];
}
