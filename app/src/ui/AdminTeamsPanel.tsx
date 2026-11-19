import { useCallback, useEffect, useState, type FormEvent } from "react";
import { correctIdentity, listCompaniesWithTeams, type AdminCompany } from "../admin/teams";
import type { CompanyMember } from "../company/members";
import { formatCpf, formatPhone, isValidCpf, normalizeCpf } from "../lib/cpf";
import { photoUrl } from "../profile/photos";

function Photo({ member }: { member: CompanyMember }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!member.photoPath) return;
    let cancelled = false;
    void photoUrl(member.photoPath).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [member.photoPath]);
  return url ? <img className="member-photo" src={url} alt={member.fullName ?? member.email ?? "Foto"} /> : null;
}

function MemberRow({ member, onSaved }: { member: CompanyMember; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.fullName ?? "");
  const [cpf, setCpf] = useState(formatCpf(member.cpf ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Digite o nome completo.");
      return;
    }
    if (!isValidCpf(cpf)) {
      setError("CPF inválido.");
      return;
    }
    setBusy(true);
    try {
      await correctIdentity(member.id, name, normalizeCpf(cpf));
      setEditing(false);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a correção.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="member-row">
      <Photo member={member} />
      <div>
        <strong>{member.fullName ?? member.email ?? "Sem nome"}</strong>
        {member.jobTitle && <span> — {member.jobTitle}</span>}
        {member.isOwner && <span> (dono)</span>}
        {!member.active && <span> (revogado)</span>}
        {member.active && !member.registered && <span> — Cadastro pendente</span>}
        {member.email && <div>{member.email}</div>}
        {member.cpf && <div>CPF {formatCpf(member.cpf)}</div>}
        {member.phone && <div>Tel. {formatPhone(member.phone)}</div>}
        {editing ? (
          <form onSubmit={onSubmit} noValidate>
            <label>
              Nome completo
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              CPF
              <input inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} />
            </label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={busy}>Salvar</button>
            <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
          </form>
        ) : (
          member.registered && (
            <button type="button" onClick={() => setEditing(true)}>
              Corrigir nome/CPF
            </button>
          )
        )}
      </div>
    </li>
  );
}

// Painel Admin: empresas parceiras e a equipe de cada uma.
export function AdminTeamsPanel() {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setCompanies(await listCompaniesWithTeams());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as empresas.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <section aria-label="Empresas e equipes">
      <h3>Empresas e equipes</h3>
      {error && <p role="alert">{error}</p>}
      {companies.map((c) => (
        <details key={c.id}>
          <summary>
            <span>{c.name}</span> <span>({c.members.filter((m) => m.active).length} ativos)</span>
          </summary>
          <ul>
            {c.members.map((m) => (
              <MemberRow key={m.id} member={m} onSaved={reload} />
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
