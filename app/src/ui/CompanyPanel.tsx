import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { invokeEdgeFunction } from "../lib/edgeFunctions";
import { listCompanyMembers, type CompanyMember } from "../company/members";

// Equipe da empresa. Só o dono convida/revoga — e a Edge Function confere
// isso de novo no servidor; aqui é só o que a tela mostra.
export function CompanyPanel({ onClose }: { onClose?: () => void }) {
  const { profile } = useAuth();
  const companyId = profile?.companyId ?? null;
  const isOwner = profile?.isOwner === true;
  const [team, setTeam] = useState<CompanyMember[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!companyId) return;
    try {
      setTeam(await listCompanyMembers(companyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a equipe.");
    }
  }, [companyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(action: () => Promise<void>, success: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      setNotice(success);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a operação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function onInvite(event: FormEvent) {
    event.preventDefault();
    const target = email.trim();
    if (!target) return;
    void run(async () => {
      await invokeEdgeFunction("company-invite-colleague", { email: target });
      setEmail("");
    }, `Convite enviado para ${target}.`);
  }

  function onRevoke(member: CompanyMember) {
    void run(() => invokeEdgeFunction("company-revoke-member", { userId: member.id }).then(() => {}), `Acesso de ${member.email} revogado.`);
  }

  return (
    <div role="dialog" aria-label="Minha empresa">
      {onClose && (
        <button type="button" onClick={onClose} className="dialog-close" aria-label="Fechar">
          ✕
        </button>
      )}
      <h2>Minha empresa</h2>
      <ul>
        {team.map((m) => (
          <li key={m.id}>
            <span>{m.email}</span> — {m.isOwner ? "dono" : "colega"}
            {!m.active && " (revogado)"}
            {isOwner && !m.isOwner && m.active && (
              <button type="button" disabled={busy} onClick={() => onRevoke(m)}>
                Revogar
              </button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form onSubmit={onInvite}>
          <fieldset>
            <legend>Convidar colega</legend>
            <label>
              Email do colega
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button type="submit" disabled={busy}>
              Convidar
            </button>
          </fieldset>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
