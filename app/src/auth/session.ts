import { supabase } from "../lib/supabaseClient";

// Sessão única por conta. Só um login de verdade (senha ou link) reivindica
// a sessão; recarregar a página nunca reivindica. Quem manda é o servidor:
// a RLS só deixa passar o session_id reivindicado.
export const SESSION_REPLACED_MESSAGE = "Seu acesso neste aparelho foi encerrado porque a conta entrou em outro aparelho.";

export async function claimSession(): Promise<void> {
  const { error } = await supabase.rpc("claim_session", { p_user_agent: navigator.userAgent });
  if (error) throw new Error("Não foi possível iniciar a sessão.");
  // Mata os refresh tokens dos outros aparelhos (o access token deles já não
  // passa pela RLS desde a reivindicação).
  await supabase.auth.signOut({ scope: "others" });
}

export async function isCurrentSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("session_is_current");
    if (error) return true; // instabilidade de rede não derruba ninguém
    return data !== false;
  } catch {
    return true;
  }
}

// Enquanto um login reivindica a sessão, quem for carregar dados espera
// (senão a primeira leitura acontece antes da reivindicação e volta vazia).
let claimGate: Promise<void> | null = null;

export function waitForClaim(): Promise<void> {
  return claimGate ?? Promise.resolve();
}

export async function loginAndClaim<T extends { error: unknown }>(login: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  claimGate = gate;
  try {
    const result = await login();
    if (!result.error) {
      try {
        await claimSession();
      } catch (err) {
        await supabase.auth.signOut({ scope: "local" });
        throw err;
      }
    }
    return result;
  } finally {
    if (claimGate === gate) claimGate = null;
    release();
  }
}
