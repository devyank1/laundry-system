import { supabase } from "../lib/supabaseClient";
import type { CompanyMember } from "../company/members";
import { normalizeCpf } from "../lib/cpf";
import { registrationErrorMessage } from "../profile/registration";

export interface AdminCompany {
  id: string;
  name: string;
  members: CompanyMember[];
}

interface ProfileRow {
  id: string;
  company_id: string;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  photo_path: string | null;
  is_owner: boolean;
  active: boolean;
  registration_completed_at: string | null;
}

// Só admin enxerga tudo (policies "admin all"); pra qualquer outro papel a
// RLS devolve vazio.
export async function listCompaniesWithTeams(): Promise<AdminCompany[]> {
  const [companies, profiles] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id, company_id, full_name, job_title, email, cpf, phone, photo_path, is_owner, active, registration_completed_at")
      .eq("role", "empresa")
      .order("created_at"),
  ]);
  if (companies.error || profiles.error) throw new Error("Não foi possível carregar as empresas.");
  const byCompany = new Map<string, CompanyMember[]>();
  for (const r of (profiles.data ?? []) as ProfileRow[]) {
    const list = byCompany.get(r.company_id) ?? [];
    list.push({
      id: r.id,
      fullName: r.full_name,
      jobTitle: r.job_title,
      email: r.email,
      cpf: r.cpf,
      phone: r.phone,
      photoPath: r.photo_path,
      isOwner: r.is_owner,
      active: r.active,
      registered: Boolean(r.registration_completed_at),
    });
    byCompany.set(r.company_id, list);
  }
  return ((companies.data ?? []) as { id: string; name: string }[]).map((c) => ({ ...c, members: byCompany.get(c.id) ?? [] }));
}

// Correção de nome/CPF: só o admin (RLS). A auditoria registra quem mudou.
export async function correctIdentity(userId: string, fullName: string, cpf: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim(), cpf: normalizeCpf(cpf) })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(registrationErrorMessage(error));
  if (!data || data.length === 0) throw new Error("Não foi possível salvar a correção.");
}
