import { create } from "zustand";
import type {
  LayoutOrientation,
  MachineSelection,
  ProjectState,
  SideSlot,
  TechAccessSide,
} from "../engine/types";
import type { SceneLighting } from "../viewer3d/lighting";

export type LogoStyle = "3d" | "flat";
export type LogoSideColor = "white" | "black" | "steel";

interface ProjectStore extends ProjectState {
  setRoomWidthMm: (mm: number) => void;
  setRoomDepthMm: (mm: number) => void;
  setRoomAreaM2: (areaM2: number) => void;
  setCeilingHeightMm: (mm: number) => void;
  setOrientation: (orientation: LayoutOrientation) => void;
  setMachineQty: (catalogId: string, qty: number) => void;
  removeMachine: (catalogId: string) => void;
  toggleDoor: () => void;
  setTechAccessSide: (side: TechAccessSide) => void;
  toggleFurniture: () => void;
  setTotemSide: (side: TechAccessSide) => void;
  setTableSide: (side: TechAccessSide) => void;
  setChairsSide: (side: TechAccessSide) => void;
  setAcSide: (side: TechAccessSide) => void;
  setMachineWall: (side: TechAccessSide) => void;
  setTableSlot: (slot: SideSlot) => void;
  setChairsSlot: (slot: SideSlot) => void;
  setAcSlot: (slot: SideSlot) => void;
  setCounterSide: (side: TechAccessSide) => void;
  setCounterSlot: (slot: SideSlot) => void;
  setAcOverrideBTU: (btu: number | null) => void;
  // Logo do protótipo (PNG com fundo transparente, como data URL), mostrada
  // no 3D em cima das máquinas. Só visual — o motor de layout não usa.
  logoDataUrl: string | null;
  setLogoDataUrl: (url: string | null) => void;
  // "3d" = letreiro extrudado a partir da transparência do PNG; "flat" = adesivo.
  logoStyle: LogoStyle;
  setLogoStyle: (style: LogoStyle) => void;
  logoDepthMm: number;
  setLogoDepthMm: (mm: number) => void;
  logoSideColor: LogoSideColor;
  setLogoSideColor: (color: LogoSideColor) => void;
  // Fachada no 3D (modelo da referência em img/): mostrar/esconder e cores HEX.
  facadeVisible: boolean;
  toggleFacade: () => void;
  facadeColor: string;
  setFacadeColor: (hex: string) => void;
  facadeSignColor: string;
  setFacadeSignColor: (hex: string) => void;
  sceneLighting: SceneLighting;
  setSceneLighting: (mode: SceneLighting) => void;
  roofVisible: boolean;
  toggleRoof: () => void;
  // Modo inauguração: itens de festa no 3D (balões, pipoca, lembranças...).
  inauguracao: boolean;
  toggleInauguracao: () => void;
}

const initialState: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 6000, // 30m² de área padrão
  ceilingHeightMm: 2800, // pé-direito recomendado pro primeiro passo do projeto
  orientation: "back",
  machines: [{ catalogId: "sq-stack", qty: 3 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  // Por padrão tudo agrupado do lado oposto à porta técnica (arranjo mais
  // econômico de espaço), mas cada item pode ser movido independentemente.
  totemSide: "left",
  tableSide: "left",
  chairsSide: "left",
  acSide: "left",
  // orientation="side": fileira na parede esquerda da planta, mobiliário na
  // parede oposta (mesa+cadeiras em cima, AC embaixo).
  machineWall: "left",
  tableSlot: "farTop",
  chairsSlot: "farTop",
  acSlot: "farBottom",
  counterSide: "right",
  counterSlot: "farBottom",
  acOverrideBTU: null,
};

export const useProjectStore = create<ProjectStore>()((set) => ({
  ...initialState,
  setRoomWidthMm: (mm) => set({ roomWidthMm: mm }),
  setRoomDepthMm: (mm) => set({ roomDepthMm: mm }),
  setRoomAreaM2: (areaM2) =>
    set((state) =>
      state.roomWidthMm > 0
        ? { roomDepthMm: Math.round((areaM2 * 1_000_000) / state.roomWidthMm) }
        : {}
    ),
  setCeilingHeightMm: (mm) => set({ ceilingHeightMm: mm }),
  setOrientation: (orientation) => set({ orientation }),
  setMachineQty: (catalogId, qty) =>
    set((state) => {
      const exists = state.machines.some((m) => m.catalogId === catalogId);
      const machines: MachineSelection[] = exists
        ? state.machines.map((m) => (m.catalogId === catalogId ? { ...m, qty } : m))
        : [...state.machines, { catalogId, qty }];
      return { machines: machines.filter((m) => m.qty > 0) };
    }),
  removeMachine: (catalogId) =>
    set((state) => ({ machines: state.machines.filter((m) => m.catalogId !== catalogId) })),
  toggleDoor: () => set((state) => ({ doorEnabled: !state.doorEnabled })),
  setTechAccessSide: (side) => set({ techAccessSide: side }),
  toggleFurniture: () => set((state) => ({ furnitureEnabled: !state.furnitureEnabled })),
  setTotemSide: (side) => set({ totemSide: side }),
  setTableSide: (side) => set({ tableSide: side }),
  setChairsSide: (side) => set({ chairsSide: side }),
  setAcSide: (side) => set({ acSide: side }),
  setMachineWall: (side) => set({ machineWall: side }),
  setTableSlot: (slot) => set({ tableSlot: slot }),
  setChairsSlot: (slot) => set({ chairsSlot: slot }),
  setAcSlot: (slot) => set({ acSlot: slot }),
  setCounterSide: (side) => set({ counterSide: side }),
  setCounterSlot: (slot) => set({ counterSlot: slot }),
  setAcOverrideBTU: (btu) => set({ acOverrideBTU: btu }),
  logoDataUrl: null,
  setLogoDataUrl: (url) => set({ logoDataUrl: url }),
  logoStyle: "3d",
  setLogoStyle: (style) => set({ logoStyle: style }),
  logoDepthMm: 30,
  setLogoDepthMm: (mm) => set({ logoDepthMm: mm }),
  logoSideColor: "white",
  setLogoSideColor: (color) => set({ logoSideColor: color }),
  facadeVisible: true,
  toggleFacade: () => set((state) => ({ facadeVisible: !state.facadeVisible })),
  facadeColor: "#8fa892", // verde-sálvia da referência
  setFacadeColor: (hex) => set({ facadeColor: hex }),
  facadeSignColor: "#a8977c", // bege granilite do painel
  setFacadeSignColor: (hex) => set({ facadeSignColor: hex }),
  sceneLighting: "day",
  setSceneLighting: (mode) => set({ sceneLighting: mode }),
  roofVisible: true,
  toggleRoof: () => set((state) => ({ roofVisible: !state.roofVisible })),
  inauguracao: false,
  toggleInauguracao: () => set((state) => ({ inauguracao: !state.inauguracao })),
}));
