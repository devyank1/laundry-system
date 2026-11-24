import { supabase } from "../lib/supabaseClient";
import type { MfaState, Role } from "./types";

// Código no celular (TOTP) obrigatório para admin. A tela só guia: quem barra
// de verdade é o banco (current_profile exige aal2) e as Edge Functions.

interface Factor {
  id: string;
  status: string;
  factor_type?: string;
}

async function totpFactors(): Promise<Factor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) throw new Error("Não foi possível consultar o código do celular.");
  return ((data.all ?? []) as Factor[]).filter((f) => !f.factor_type || f.factor_type === "totp");
}

export async function mfaStateFor(role: Role): Promise<MfaState> {
  if (role !== "admin") return "ok";
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return "verify";
    if (data.currentLevel === "aal2") return "ok";
    const factors = await totpFactors();
    return factors.some((f) => f.status === "verified") ? "verify" : "enroll";
  } catch {
    return "verify";
  }
}

export async function verifiedFactorId(): Promise<string | null> {
  return (await totpFactors()).find((f) => f.status === "verified")?.id ?? null;
}

export async function startEnroll(): Promise<{ factorId: string; qrCode: string; secret: string }> {
  // Cadastro abandonado (QR gerado e nunca confirmado) bloquearia um novo.
  for (const f of await totpFactors()) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Configurador" });
  if (error || !data) throw new Error("Não foi possível gerar o QR code. Tente novamente.");
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyCode(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new Error("Código inválido.");
}
