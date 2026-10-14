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

// "back" (padrão): fileira de máquinas contra a parede de fundo (como hoje).
// "side": fileira girada 90°, contra uma parede lateral.
export type LayoutOrientation = "back" | "side";

export interface ProjectState {
  roomWidthMm: number;
  roomDepthMm: number;
  ceilingHeightMm: number;
  orientation: LayoutOrientation;
  machines: MachineSelection[];
  doorEnabled: boolean;
  techAccessSide: TechAccessSide;
  furnitureEnabled: boolean;
  totemSide: TechAccessSide;
  tableSide: TechAccessSide;
  chairsSide: TechAccessSide;
  acSide: TechAccessSide;
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
  poufs: Rect[];
  totem: Rect;
  ac: Rect;
  acWall: "left" | "right";
}

export interface Layout {
  orientation: LayoutOrientation;
  machines: PlacedMachine[];
  // "y" é a distância até a parede que a fileira encosta. Em orientation="back"
  // isso é uma posição Y de verdade (desenhar como linha HORIZONTAL). Em
  // orientation="side" o motor já girou tudo e esse mesmo valor passa a ser
  // uma posição X (desenhar como linha VERTICAL) — o viewer decide com base
  // em `orientation`, o nome do campo não muda pra não precisar duplicar tipo.
  drywall: { y: number; openings: DrywallOpening[]; heightMm: number };
  techCorridor: Rect;
  techDoor: Rect;
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
