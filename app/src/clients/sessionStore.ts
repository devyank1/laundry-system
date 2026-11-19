import { create } from "zustand";
import { meetingFingerprint } from "./meeting";

// Cliente "ligado" à tela: "Salvar reunião" grava nele até fechar/abrir
// outro. baseline = retrato da tela no último abrir/salvar.
export interface MeetingSession {
  clientId: string | null;
  clientName: string | null;
  canSave: boolean;
  baseline: string;
  bind: (c: { id: string; name: string; canSave: boolean }) => void;
  markSaved: () => void;
  unbind: () => void;
  isDirty: () => boolean;
}

export const useMeetingSession = create<MeetingSession>((set, get) => ({
  clientId: null,
  clientName: null,
  canSave: false,
  baseline: meetingFingerprint(),
  bind: (c) => set({ clientId: c.id, clientName: c.name, canSave: c.canSave, baseline: meetingFingerprint() }),
  markSaved: () => set({ baseline: meetingFingerprint() }),
  unbind: () => set({ clientId: null, clientName: null, canSave: false, baseline: meetingFingerprint() }),
  isDirty: () => meetingFingerprint() !== get().baseline,
}));
