import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { supabase } from "../lib/supabaseClient";
import { loginAndClaim } from "../auth/session";
import { InviteExpiredPage } from "./ErrorPages";
import { AuthLoading } from "../auth/RouteGuards";
import { LogoMark } from "./icons";
import "./statusPages.css";

// Links de convite (Edge Functions) e de "esqueci minha senha" (template de
// email do Supabase) chegam como /set-password?token_hash=...&type=...
const LINK_TYPES = ["invite", "recovery"] as const;
type LinkType = (typeof LINK_TYPES)[number];

function isLinkType(value: string | null): value is LinkType {
  return value !== null && (LINK_TYPES as readonly string[]).includes(value);
}

// Mesma regra do Supabase Auth (config.toml): 8+ caracteres, letra e número.
function passwordProblem(password: string): string | null {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "A senha precisa de pelo menos 8 caracteres, com letras e números.";
  }
  return null;
}

export function SetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const [status, setStatus] = useState<"verifying" | "ready" | "invalid">("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // O token é de uso único: no StrictMode o efeito roda duas vezes e a
  // segunda verificação falharia, então só verifica uma vez por token.
  const verifiedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!tokenHash || !isLinkType(type)) return;
    if (verifiedToken.current === tokenHash) return;
    verifiedToken.current = tokenHash;
    void (async () => {
      try {
        const { error: otpError } = await loginAndClaim(() => supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
        setStatus(otpError ? "invalid" : "ready");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [tokenHash, type]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Não foi possível salvar a senha. Tente outra senha ou peça um novo link.");
        return;
      }
      navigate("/", { replace: true });
    } catch {
      setError("Não foi possível salvar a senha. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  const linkOk = Boolean(tokenHash) && isLinkType(type);
  if (!linkOk || status === "invalid") return <InviteExpiredPage />;
  if (status === "verifying") return <AuthLoading />;

  return (
    <main className="status-page">
      <div className="status-card">
        <LogoMark />
        <h1>Defina sua senha</h1>
        <p className="status-body">Use pelo menos 8 caracteres, com letras e números.</p>
        <form className="status-form" onSubmit={onSubmit}>
          <label>
            Nova senha
            <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            Confirme a senha
            <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {error && <p className="status-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>Salvar senha</button>
        </form>
      </div>
    </main>
  );
}
