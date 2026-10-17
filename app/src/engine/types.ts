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

// Posição do mobiliário em orientation="side" (a fileira encosta numa parede
// lateral da planta). "near" = no salão, em frente às máquinas (do mesmo lado
// delas); "farTop"/"farBottom" = na parede oposta às máquinas, metade de cima
// ou de baixo da planta.
export type SideSlot = "near" | "farTop" | "farBottom";

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
  // Só valem em orientation="side": em qual parede lateral da planta a
  // fileira encosta, e o encaixe de mesa/cadeiras/AC (tableSide/chairsSide/
  // acSide continuam valendo só em orientation="back").
  machineWall: TechAccessSide;
  tableSlot: SideSlot;
  chairsSlot: SideSlot;
  acSlot: SideSlot;
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

// Parede da planta em que um item encosta as costas: "left"/"right" = x=0 /
// x=roomWidth; "top"/"bottom" = y=0 / y=roomDepth (fachada). O drywall conta
// como a parede do lado das máquinas. O viewer 3D vira o item pra frente.
export type WallSide = "left" | "right" | "top" | "bottom";

export interface FurnitureLayout {
  table: Rect;
  poufs: Rect[];
  // Pra onde as costas das cadeiras ficam viradas.
  chairsWall: WallSide;
  totem: Rect;
  ac: Rect;
  acWall: WallSide;
}

export interface Layout {
  orientation: LayoutOrientation;
  // Em orientation="side": parede lateral da planta onde a fileira encosta.
  // Sempre "left" em orientation="back" (não se aplica).
  machineWall: TechAccessSide;
  machines: PlacedMachine[];
  // "y" é a distância até a parede que a fileira encosta. Em orientation="back"
  // isso é uma posição Y de verdade (desenhar como linha HORIZONTAL). Em
  // orientation="side" o motor já girou tudo e esse mesmo valor passa a ser
  // uma distância em X (desenhar como linha VERTICAL), medida a partir da
  // parede `machineWall` — o viewer decide com base em `orientation`.
  drywall: { y: number; openings: DrywallOpening[]; heightMm: number };
  techCorridor: Rect;
  techDoor: Rect;
  // Sempre na fachada (parede de baixo da planta, y = roomDepthMm), nas duas
  // orientações: x/width são a posição real da porta nessa parede.
  frontDoor: Rect | null;
  furniture: FurnitureLayout | null;
  acSuggestedBTU: number;
  // Área social (salão, sem a área técnica) — base do cálculo de BTU.
  salonAreaM2: number;
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
