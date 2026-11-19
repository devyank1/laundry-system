import { supabase } from "../lib/supabaseClient";
import { normalizeCpf, normalizePhone } from "../lib/cpf";

export interface RegistrationInput {
  fullName: string;
  cpf: string;
  phone: string;
  jobTitle: string;
  photoPath: string;
}

// Mensagens fixas: nunca diz de quem é o CPF/telefone repetido.
export function registrationErrorMessage(error: { code?: string; message?: string }): string {
  const msg = error.message ?? "";
  if (error.code === "23505" && msg.includes("cpf")) return "Este CPF já está em uso.";
  if (error.code === "23505" && msg.includes("phone")) return "Este telefone já está em uso.";
  if (msg.includes("invalid_cpf")) return "CPF inválido.";
  if (msg.includes("invalid_phone")) return "Telefone inválido. Use DDD + número.";
  if (msg.includes("missing_field")) return "Preencha todos os campos e envie uma foto.";
  if (error.code === "42501") return "Sua sessão não vale mais neste aparelho. Entre de novo.";
  return "Não foi possível salvar. Tente novamente em instantes.";
}

// Recusa por CPF/telefone repetido volta como código (o servidor audita a
// tentativa e não pode dar erro, senão o log seria desfeito).
function checkResult(data: unknown): void {
  if (data === "cpf_taken") throw new Error("Este CPF já está em uso.");
  if (data === "phone_taken") throw new Error("Este telefone já está em uso.");
}

export async function completeRegistration(input: RegistrationInput): Promise<void> {
  const { data, error } = await supabase.rpc("complete_registration", {
    p_full_name: input.fullName.trim(),
    p_cpf: normalizeCpf(input.cpf),
    p_phone: normalizePhone(input.phone),
    p_job_title: input.jobTitle.trim(),
    p_photo_path: input.photoPath,
  });
  if (error) throw new Error(registrationErrorMessage(error));
  checkResult(data);
}

export async function updateMyContact(input: { phone: string; jobTitle: string; photoPath: string }): Promise<void> {
  const { data, error } = await supabase.rpc("update_my_contact", {
    p_phone: normalizePhone(input.phone),
    p_job_title: input.jobTitle.trim(),
    p_photo_path: input.photoPath,
  });
  if (error) throw new Error(registrationErrorMessage(error));
  checkResult(data);
}

export interface MyData {
  fullName: string | null;
  cpf: string | null;
  phone: string | null;
  jobTitle: string | null;
  photoPath: string | null;
}

export async function loadMyData(userId: string): Promise<MyData> {
  const { data, error } = await supabase.from("profiles").select("full_name, cpf, phone, job_title, photo_path").eq("id", userId).single();
  if (error || !data) throw new Error("Não foi possível carregar seus dados.");
  const row = data as { full_name: string | null; cpf: string | null; phone: string | null; job_title: string | null; photo_path: string | null };
  return { fullName: row.full_name, cpf: row.cpf, phone: row.phone, jobTitle: row.job_title, photoPath: row.photo_path };
}
