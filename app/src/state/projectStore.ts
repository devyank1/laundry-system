import { create } from "zustand";
import type { MachineSelection, ProjectState, TechAccessSide } from "../engine/types";

interface ProjectStore extends ProjectState {
  setRoomWidthMm: (mm: number) => void;
  setRoomDepthMm: (mm: number) => void;
  setRoomAreaM2: (areaM2: number) => void;
  setCeilingHeightMm: (mm: number) => void;
  setMachineQty: (catalogId: string, qty: number) => void;
  removeMachine: (catalogId: string) => void;
  toggleDoor: () => void;
  setTechAccessSide: (side: TechAccessSide) => void;
  toggleFurniture: () => void;
  setTotemSide: (side: TechAccessSide) => void;
  setTableSide: (side: TechAccessSide) => void;
  setChairsSide: (side: TechAccessSide) => void;
  setAcSide: (side: TechAccessSide) => void;
  setAcOverrideBTU: (btu: number | null) => void;
}

const initialState: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 6000, // 30m² de área padrão
  ceilingHeightMm: 2700,
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
  setAcOverrideBTU: (btu) => set({ acOverrideBTU: btu }),
}));
