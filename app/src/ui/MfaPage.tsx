import { useEffect, useState, type FormEvent } from "react";
import { startEnroll, verifiedFactorId, verifyCode } from "../auth/mfa";
import { LogoMark } from "./icons";
import "./statusPages.css";

interface Props {
  mode: "enroll" | "verify";
  // Recarrega perfil e catálogo já com o código validado (aal2).
  onDone: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

// Admin: senha + código de 6 dígitos de um app autenticador.
export function MfaPage({ mode, onDone, onSignOut }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<{ qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (mode === "enroll") {
          const enrolled = await startEnroll();
          if (cancelled) return;
          setFactorId(enrolled.factorId);
          setQr({ qrCode: enrolled.qrCode, secret: enrolled.secret });
        } else {
          const id = await verifiedFactorId();
          if (!cancelled) setFactorId(id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível preparar o código. Tente novamente.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Digite os 6 números do app autenticador.");
      return;
    }
    if (!factorId) {
      setError("Não foi possível preparar o código. Saia e entre de novo.");
      return;
    }
    setBusy(true);
    try {
      await verifyCode(factorId, code);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="status-page">
      <div className="status-card">
        <LogoMark />
        <h1>{mode === "enroll" ? "Proteja sua conta de admin" : "Código de verificação"}</h1>
        {mode === "enroll" ? (
          <>
            <p className="status-body">
              Abra um app autenticador (Google Authenticator, Microsoft Authenticator ou Authy), toque em adicionar e
              leia o QR code. Depois digite o código de 6 números que aparecer.
            </p>
            {qr && (
              <>
                <img className="mfa-qr" src={qr.qrCode} alt="QR code para o app autenticador" width={180} height={180} />
                <p className="status-body">
                  Sem câmera? Digite esta chave no app: <code>{qr.secret}</code>
                </p>
              </>
            )}
          </>
        ) : (
          <p className="status-body">Digite o código de 6 números do seu app autenticador.</p>
        )}
        <form className="status-form" onSubmit={onSubmit}>
          <label>
            Código de 6 dígitos
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
            />
          </label>
          {error && <p className="status-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>Confirmar</button>
        </form>
        <button type="button" className="status-link status-link-button" onClick={() => void onSignOut()} disabled={busy}>
          Sair
        </button>
      </div>
    </main>
  );
}
