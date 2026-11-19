import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { formatCpf, formatPhone, isValidPhone } from "../lib/cpf";
import { photoProblem, photoUrl, shrinkPhoto, uploadMyPhoto } from "../profile/photos";
import { loadMyData, updateMyContact, type MyData } from "../profile/registration";

// "Meus dados": a pessoa troca telefone, cargo e foto. Nome e CPF só o admin
// corrige (o servidor também não deixa: update_my_contact não mexe neles).
export function MyDataPanel({ onClose }: { onClose?: () => void }) {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const [data, setData] = useState<MyData | null>(null);
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadMyData(userId);
        if (cancelled) return;
        setData(loaded);
        setPhone(formatPhone(loaded.phone ?? ""));
        setJobTitle(loaded.jobTitle ?? "");
        if (loaded.photoPath) {
          const url = await photoUrl(loaded.photoPath);
          if (!cancelled) setCurrentPhoto(url);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar seus dados.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!userId || !data) return;
    setError(null);
    setNotice(null);
    if (!isValidPhone(phone)) {
      setError("Telefone inválido. Use DDD + número.");
      return;
    }
    if (!jobTitle.trim()) {
      setError("Digite seu cargo.");
      return;
    }
    setBusy(true);
    try {
      let photoPath = data.photoPath ?? `${userId}/photo`;
      if (file) {
        const ready = await shrinkPhoto(file);
        const problem = photoProblem(ready);
        if (problem) {
          setError(problem);
          return;
        }
        photoPath = await uploadMyPhoto(userId, ready);
        const url = await photoUrl(photoPath);
        setCurrentPhoto(url);
        setFile(null);
      }
      await updateMyContact({ phone, jobTitle, photoPath });
      setNotice("Dados salvos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-label="Meus dados">
      {onClose && (
        <button type="button" onClick={onClose} className="dialog-close" aria-label="Fechar">
          ✕
        </button>
      )}
      <h2>Meus dados</h2>
      {data && (
        <>
          {currentPhoto && <img className="member-photo" src={currentPhoto} alt={data.fullName ?? "Sua foto"} />}
          <dl>
            <dt>Nome completo</dt>
            <dd>{data.fullName}</dd>
            <dt>CPF</dt>
            <dd>{formatCpf(data.cpf ?? "")}</dd>
          </dl>
          <p>Para corrigir nome ou CPF, fale com o administrador.</p>
          <form onSubmit={onSubmit} noValidate>
            <label>
              Telefone (com DDD)
              <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
            </label>
            <label>
              Cargo
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </label>
            <label>
              Trocar foto
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </button>
          </form>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
