import { create } from "zustand";
import { meetingFingerprint } from "./meeting";

// Cliente "ligado" à tela: "Salvar reunião" grava nele até fechar/abrir
// outro. baseline = retrato da tela no último abrir/salvar.
export interface BoundClient {
  id: string;
  name: string;
  canSave: boolean;
  companyId?: string;
  logoPath?: string | null;
}

export interface MeetingSession {
  clientId: string | null;
  clientName: string | null;
  companyId: string | null;
  logoPath: string | null;
  canSave: boolean;
  baseline: string;
  bind: (c: BoundClient) => void;
  /** depois de salvar: novo retrato e o caminho da logo gravada (null = sem logo) */
  markSaved: (logoPath?: string | null) => void;
  setCanSave: (canSave: boolean) => void;
  unbind: () => void;
  isDirty: () => boolean;
}

export const useMeetingSession = create<MeetingSession>((set, get) => ({
  clientId: null,
  clientName: null,
  companyId: null,
  logoPath: null,
  canSave: false,
  baseline: meetingFingerprint(),
  bind: (c) =>
    set({
      clientId: c.id,
      clientName: c.name,
      canSave: c.canSave,
      companyId: c.companyId ?? null,
      logoPath: c.logoPath ?? null,
      baseline: meetingFingerprint(),
    }),
  markSaved: (logoPath) =>
    set((s) => ({ baseline: meetingFingerprint(), logoPath: logoPath === undefined ? s.logoPath : logoPath })),
  setCanSave: (canSave) => set({ canSave }),
  // Mantém o retrato: o que não foi salvo continua contando como não salvo.
  unbind: () => set({ clientId: null, clientName: null, companyId: null, logoPath: null, canSave: false }),
  isDirty: () => meetingFingerprint() !== get().baseline,
}));
