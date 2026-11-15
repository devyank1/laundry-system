import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Só a chave anônima (pública por design) entra no navegador. A service_role
// vive apenas nas Edge Functions — nunca importe nem defina aqui.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error("Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja app/.env.example).");
}

export const supabase: SupabaseClient = createClient(url, anonKey);
