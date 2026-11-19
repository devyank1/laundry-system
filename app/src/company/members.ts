import { supabase } from "../lib/supabaseClient";

export interface CompanyMember {
  id: string;
  fullName: string | null;
  jobTitle: string | null;
  // Só vêm preenchidos pro dono (e nos próprios dados); null pros colegas.
  email: string | null;
  cpf: string | null;
  phone: string | null;
  photoPath: string | null;
  isOwner: boolean;
  active: boolean;
  registered: boolean;
}

interface TeamRow {
  id: string;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  photo_path: string | null;
  is_owner: boolean;
  active: boolean;
  registered: boolean;
}

// company_team() já filtra pela empresa de quem chama e esconde os dados
// pessoais dos colegas pra quem não é o dono.
export async function listCompanyMembers(): Promise<CompanyMember[]> {
  const { data, error } = await supabase.rpc("company_team");
  if (error) throw new Error("Não foi possível carregar a equipe.");
  return ((data ?? []) as TeamRow[]).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    jobTitle: r.job_title,
    email: r.email,
    cpf: r.cpf,
    phone: r.phone,
    photoPath: r.photo_path,
    isOwner: r.is_owner,
    active: r.active,
    registered: r.registered,
  }));
}
