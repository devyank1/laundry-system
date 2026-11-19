import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { refreshCatalog, resetCatalog } from "../catalog/store";
import { AuthContext, type AuthState } from "./authContext";
import { waitForClaim } from "./session";
import type { Profile, Role } from "./types";

interface ProfileRow {
  id: string;
  role: Role;
  company_id: string | null;
  is_owner: boolean;
  active: boolean;
  full_name: string | null;
  registration_completed_at: string | null;
}

const PROFILE_COLUMNS = "id, role, company_id, is_owner, active, full_name, registration_completed_at";

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: row.role,
    companyId: row.company_id,
    isOwner: row.is_owner,
    active: row.active,
    fullName: row.full_name ?? null,
    registrationComplete: Boolean(row.registration_completed_at),
  };
}

// Perfil ativo + catálogo (já filtrado pela RLS). null = sem perfil/revogado.
async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single();
  const row = data as ProfileRow | null;
  if (error || !row || !row.active) return null;
  try {
    await refreshCatalog();
  } catch {
    /* catálogo indisponível: a tela abre e mostra a lista vazia */
  }
  return toProfile(row);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = ainda não sabemos se há sessão; null = sem sessão.
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Para qual userId o perfil já foi resolvido (evita um render "logado sem
  // perfil" que mandaria pro /login antes da busca terminar).
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);

  useEffect(() => {
    // O callback só guarda o id: chamar o supabase de dentro dele pode travar
    // o lock interno da sessão, então a busca do perfil fica no efeito abaixo.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      // Saiu (ou nunca entrou): nada do catálogo da conta anterior fica em memória.
      resetCatalog();
      return;
    }
    let cancelled = false;
    void (async () => {
      // Login em andamento: só lê depois da sessão reivindicada (antes disso
      // a RLS devolve tudo vazio).
      await waitForClaim();
      if (cancelled) return;
      const loaded = await loadProfile(userId);
      if (cancelled) return;
      if (!loaded) {
        // Sem perfil ou revogado: não fica logado nem pela metade.
        setProfile(null);
        await supabase.auth.signOut();
      } else {
        setProfile(loaded);
      }
      if (!cancelled) setResolvedFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const loaded = await loadProfile(userId);
    if (loaded) setProfile(loaded);
  }, [userId]);

  const value = useMemo<AuthState>(
    // Perfil só vale pro usuário da sessão atual (troca de conta não vaza o anterior).
    () => ({ profile: userId && resolvedFor === userId ? profile : null, loading: userId === undefined || (userId !== null && resolvedFor !== userId), signOut, refreshProfile }),
    [profile, userId, resolvedFor, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
