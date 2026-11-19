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

export async function completeRegistration(input: RegistrationInput): Promise<void> {
  const { error } = await supabase.rpc("complete_registration", {
    p_full_name: input.fullName.trim(),
    p_cpf: normalizeCpf(input.cpf),
    p_phone: normalizePhone(input.phone),
    p_job_title: input.jobTitle.trim(),
    p_photo_path: input.photoPath,
  });
  if (error) throw new Error(registrationErrorMessage(error));
}

export async function updateMyContact(input: { phone: string; jobTitle: string; photoPath: string }): Promise<void> {
  const { error } = await supabase.rpc("update_my_contact", {
    p_phone: normalizePhone(input.phone),
    p_job_title: input.jobTitle.trim(),
    p_photo_path: input.photoPath,
  });
  if (error) throw new Error(registrationErrorMessage(error));
}
