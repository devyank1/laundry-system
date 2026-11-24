import { useCallback, useEffect, useState, type FormEvent } from "react";
import { listAdmins, type AdminAccount } from "../admin/admins";
import { invokeEdgeFunction } from "../lib/edgeFunctions";

// Admin convida outro admin: a pessoa recebe email e define a própria senha.
// A Edge Function reconfirma no servidor que quem chama é admin.
export function AdminAdminsPanel() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setAdmins(await listAdmins());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os administradores.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const target = email.trim();
    if (!target) {
      setError("Digite o email do novo admin.");
      return;
    }
    setBusy(true);
    try {
      await invokeEdgeFunction<{ userId: string }>("admin-invite-admin", { email: target });
      setSuccess(`Convite enviado para ${target}. A pessoa define a senha pelo email.`);
      setEmail("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o convite. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Administradores">
      <h3>Administradores</h3>
      <ul>
        {admins.map((a) => (
          <li key={a.id}>
            <span>{a.email ?? "(sem email)"}</span> · desde {new Date(a.createdAt).toLocaleDateString("pt-BR")}
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="dialog-form">
        <label>
          Email do novo admin
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <p>Admin tem acesso total: vê e edita todas as empresas, clientes e o catálogo.</p>
        {error && <p role="alert">{error}</p>}
        {success && <p role="status">{success}</p>}
        <button type="submit" disabled={busy}>
          Convidar admin
        </button>
      </form>
    </section>
  );
}
