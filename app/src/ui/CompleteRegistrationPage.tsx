import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { formatCpf, formatPhone, isValidCpf, isValidPhone } from "../lib/cpf";
import { photoProblem, shrinkPhoto, uploadMyPhoto } from "../profile/photos";
import { completeRegistration } from "../profile/registration";
import { LogoMark } from "./icons";
import "./statusPages.css";

export const LGPD_NOTICE = "Usamos estes dados só para identificar quem usa o configurador e controlar o acesso da sua empresa.";

// Toda pessoa de empresa (dono e vendedores) passa por aqui no primeiro
// acesso. O bloqueio de verdade é no servidor: sem cadastro a RLS não libera
// nada da empresa.
export function CompleteRegistrationPage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function problem(): string | null {
    if (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) return "Digite seu nome completo.";
    if (!isValidCpf(cpf)) return "CPF inválido.";
    if (!isValidPhone(phone)) return "Telefone inválido. Use DDD + número.";
    if (!jobTitle.trim()) return "Digite seu cargo.";
    if (!file) return "Envie uma foto sua.";
    return null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const p = problem();
    if (p || !file || !profile) {
      setError(p);
      return;
    }
    setBusy(true);
    try {
      const ready = await shrinkPhoto(file);
      const photoError = photoProblem(ready);
      if (photoError) {
        setError(photoError);
        return;
      }
      const photoPath = await uploadMyPhoto(profile.id, ready);
      await completeRegistration({ fullName, cpf, phone, jobTitle, photoPath });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="status-page">
      <div className="status-card">
        <LogoMark />
        <h1>Complete seu cadastro</h1>
        <p className="status-body">{LGPD_NOTICE}</p>
        <form className="status-form" onSubmit={onSubmit} noValidate>
          <label>
            Nome completo
            <input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label>
            CPF
            <input inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" />
          </label>
          <label>
            Telefone (com DDD)
            <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(11) 98765-4321" />
          </label>
          <label>
            Cargo
            <input autoComplete="organization-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </label>
          <label>
            Foto do rosto
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {preview && <img className="status-photo" src={preview} alt="Prévia da sua foto" />}
          {error && <p className="status-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar e entrar"}</button>
        </form>
        <button type="button" className="status-link status-link-button" onClick={() => void signOut()}>
          Sair
        </button>
      </div>
    </main>
  );
}
