import { useState, useSyncExternalStore, type FormEvent } from "react";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import { invokeEdgeFunction } from "../lib/edgeFunctions";

interface CreateCompanyResponse {
  companyId: string;
}

// Só admin abre (RequireRole no App) e só admin passa na Edge Function, que
// reconfirma o papel no servidor.
export function AdminPanel({ onClose }: { onClose?: () => void }) {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [machineIds, setMachineIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setMachineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim() || !ownerEmail.trim()) {
      setError("Preencha o nome da empresa e o email do dono.");
      return;
    }
    if (machineIds.size === 0) {
      setError("Marque pelo menos uma máquina do catálogo da empresa.");
      return;
    }
    setBusy(true);
    try {
      const companyName = name.trim();
      await invokeEdgeFunction<CreateCompanyResponse>("admin-create-company", {
        name: companyName,
        machineIds: [...machineIds].sort(),
        ownerEmail: ownerEmail.trim(),
      });
      setSuccess(`Empresa “${companyName}” cadastrada. O convite foi enviado para ${ownerEmail.trim()}.`);
      setName("");
      setOwnerEmail("");
      setMachineIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a operação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-label="Painel Admin">
      {onClose && (
        <button type="button" onClick={onClose} className="dialog-close" aria-label="Fechar">
          ✕
        </button>
      )}
      <h2>Painel Admin</h2>
      <form onSubmit={onSubmit}>
        <fieldset>
          <legend>Nova empresa parceira</legend>
          <label>
            Nome da empresa
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </label>
          <label>
            Email do dono
            <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
          </label>
          <p>Máquinas que a empresa trabalha:</p>
          {catalog.map((m) => (
            <label key={m.id} className="admin-machine-option">
              <input type="checkbox" checked={machineIds.has(m.id)} onChange={() => toggle(m.id)} />
              {m.brand} {m.model}
            </label>
          ))}
          {error && <p role="alert">{error}</p>}
          {success && <p role="status">{success}</p>}
          <button type="submit" disabled={busy}>
            Cadastrar empresa
          </button>
        </fieldset>
      </form>
    </div>
  );
}
