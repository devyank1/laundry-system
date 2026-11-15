import { supabase } from "../lib/supabaseClient";

export interface CompanyMember {
  id: string;
  email: string;
  isOwner: boolean;
  active: boolean;
}

// RLS ("profiles same company read") só devolve perfis da própria empresa.
export async function listCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, is_owner, active")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar a equipe.");
  return (data ?? []).map((row: { id: string; email: string | null; is_owner: boolean; active: boolean }) => ({
    id: row.id,
    email: row.email ?? "(sem email)",
    isOwner: row.is_owner,
    active: row.active,
  }));
}
