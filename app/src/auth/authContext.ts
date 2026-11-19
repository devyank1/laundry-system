import { createContext } from "react";
import type { Profile } from "./types";

export interface AuthState {
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  // Relê perfil e catálogo (ex.: depois de completar o cadastro).
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
