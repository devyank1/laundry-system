import { create } from "zustand";
import type { MachineSelection, ProjectState, TechAccessSide } from "../engine/types";

interface ProjectStore extends ProjectState {
  setRoomWidthMm: (mm: number) => void;
  setRoomDepthMm: (mm: number) => void;
  setCeilingHeightMm: (mm: number) => void;
  setMachineQty: (catalogId: string, qty: number) => void;
  removeMachine: (catalogId: string) => void;
  toggleDoor: () => void;
  setTechAccessSide: (side: TechAccessSide) => void;
  toggleFurniture: () => void;
  setAcOverrideBTU: (btu: number | null) => void;
}

const initialState: ProjectState = {
  roomWidthMm: 4000,
  roomDepthMm: 4000,
  ceilingHeightMm: 2700,
  machines: [{ catalogId: "sq-stack", qty: 3 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  acOverrideBTU: null,
};

export const useProjectStore = create<ProjectStore>()((set) => ({
  ...initialState,
  setRoomWidthMm: (mm) => set({ roomWidthMm: mm }),
  setRoomDepthMm: (mm) => set({ roomDepthMm: mm }),
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
  setAcOverrideBTU: (btu) => set({ acOverrideBTU: btu }),
}));
