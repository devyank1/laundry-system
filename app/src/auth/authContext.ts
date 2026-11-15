import { createContext } from "react";
import type { Profile } from "./types";

export interface AuthState {
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
