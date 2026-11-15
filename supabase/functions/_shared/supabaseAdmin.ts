// Client com a chave service_role: ignora RLS. Só existe dentro das Edge
// Functions (Deno.env) — nunca importar isto em código do navegador.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";

export type { SupabaseClient };

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export function createSupabaseAdminClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
