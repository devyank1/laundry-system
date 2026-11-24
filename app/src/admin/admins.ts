import { supabase } from "../lib/supabaseClient";

export interface AdminAccount {
  id: string;
  email: string | null;
  createdAt: string;
}

// Só admin enxerga (policy "profiles admin all"); pra outros papéis vem vazio.
export async function listAdmins(): Promise<AdminAccount[]> {
  const { data, error } = await supabase.from("profiles").select("id, email, created_at").eq("role", "admin").order("created_at");
  if (error) throw new Error("Não foi possível carregar os administradores.");
  return ((data ?? []) as { id: string; email: string | null; created_at: string }[]).map((r) => ({
    id: r.id,
    email: r.email,
    createdAt: r.created_at,
  }));
}
