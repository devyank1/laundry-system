import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabaseClient";
import { LogoMark } from "./icons";
import "./statusPages.css";

// Mensagens fixas: nunca mostra error.message do servidor (vaza detalhe e
// ajuda quem tenta descobrir quais emails têm conta).
const LOGIN_FAILED = "Email ou senha incorretos.";
const RESET_SENT = "Se existir uma conta com esse email, enviamos um link para definir uma nova senha.";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError(LOGIN_FAILED);
        return;
      }
      navigate("/", { replace: true });
    } catch {
      setError(LOGIN_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Digite seu email acima para receber o link.");
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/set-password` });
    } catch {
      /* mesma resposta de qualquer jeito */
    } finally {
      setBusy(false);
      setNotice(RESET_SENT);
    }
  }

  return (
    <main className="status-page">
      <div className="status-card">
        <LogoMark />
        <h1>Entrar</h1>
        <p className="status-body">Configurador de Lavanderia</p>
        <form className="status-form" onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Senha
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="status-error" role="alert">{error}</p>}
          {notice && <p className="status-ok" role="status">{notice}</p>}
          <button type="submit" disabled={busy}>Entrar</button>
        </form>
        <button type="button" className="status-link status-link-button" onClick={() => void onForgot()} disabled={busy}>
          Esqueci minha senha
        </button>
      </div>
    </main>
  );
}
