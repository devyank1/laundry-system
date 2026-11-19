import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { getCatalog } from "../catalog/store";
import {
  clientInputProblem,
  createClient,
  deleteClient,
  duplicateOwner,
  listClients,
  loadMeetingLogo,
  logoPathFor,
  saveMeeting,
  transferClient,
  updateClient,
  type Client,
  type ClientInput,
} from "../clients/api";
import { toCsv } from "../clients/csv";
import { applyMeeting } from "../clients/meeting";
import { useMeetingSession } from "../clients/sessionStore";
import { listCompanyMembers, type CompanyMember } from "../company/members";
import { formatCnpj } from "../lib/cnpj";
import { formatPhone } from "../lib/cpf";
import { useProjectStore } from "../state/projectStore";

const EMPTY: ClientInput = { name: "", phone: "", email: "", cnpj: "", hasLocation: false, address: "", locationM2: "", notes: "" };

type Pending =
  | { kind: "open"; client: Client }
  | { kind: "save"; client: Client }
  | { kind: "delete"; client: Client };

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Clientes (leads) da empresa: vendedor vê os próprios; dono vê todos,
// transfere, exclui e baixa a planilha pro CRM.
export function ClientsPanel({ onClose }: { onClose?: () => void }) {
  const { profile } = useAuth();
  const me = profile?.id ?? "";
  const companyId = profile?.companyId ?? "";
  const isOwner = profile?.isOwner === true;
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [form, setForm] = useState<ClientInput>(EMPTY);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [transferTo, setTransferTo] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setClients(await listClients());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os clientes.");
    }
  }, []);

  useEffect(() => {
    void reload();
    if (isOwner) listCompanyMembers().then(setMembers, () => setMembers([]));
  }, [reload, isOwner]);

  // Aviso de cliente repetido (mesmo CNPJ ou telefone na empresa).
  const excludeId = editing && editing !== "new" ? editing.id : null;
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    const t = setTimeout(() => {
      duplicateOwner(form, excludeId).then((name) => alive && setDuplicate(name), () => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cnpj, form.phone, editing, excludeId]);

  async function run(action: () => Promise<void>, success: string | null) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      if (success) setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir a operação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c: Client | "new") {
    setEditing(c);
    setDuplicate(null);
    setError(null);
    setForm(c === "new" ? EMPTY : { ...c, cnpj: c.cnpj ? formatCnpj(c.cnpj) : "", phone: c.phone ? formatPhone(c.phone) : "" });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = clientInputProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    void run(async () => {
      if (editing === "new") await createClient(form, companyId, me);
      else if (editing) await updateClient(editing.id, form);
      setEditing(null);
      await reload();
    }, "Cliente salvo.");
  }

  async function doOpen(c: Client) {
    await run(async () => {
      const logo = await loadMeetingLogo(c);
      const { removed } = applyMeeting(c.meeting, logo);
      useMeetingSession.getState().bind({ id: c.id, name: c.name, canSave: c.sellerId === me, companyId: c.companyId, logoPath: c.logoPath });
      if (removed.length > 0) {
        throw new Error(`Algumas máquinas desta reunião não estão mais no catálogo e foram retiradas: ${removed.join(", ")}.`);
      }
    }, `Reunião de ${c.name} aberta.`);
  }

  async function doSave(c: Client) {
    await run(async () => {
      const logo = useProjectStore.getState().logoDataUrl;
      await saveMeeting(c, logo);
      useMeetingSession.getState().bind({ id: c.id, name: c.name, canSave: true, companyId: c.companyId, logoPath: logo ? logoPathFor(c) : null });
      await reload();
    }, `Reunião salva em ${c.name}.`);
  }

  async function doDelete(c: Client) {
    await run(async () => {
      await deleteClient(c);
      if (useMeetingSession.getState().clientId === c.id) useMeetingSession.getState().unbind();
      await reload();
    }, `${c.name} excluído.`);
  }

  function onOpen(c: Client) {
    if (useMeetingSession.getState().isDirty()) setPending({ kind: "open", client: c });
    else void doOpen(c);
  }

  function onSaveHere(c: Client) {
    if (c.meeting && useMeetingSession.getState().clientId !== c.id) setPending({ kind: "save", client: c });
    else void doSave(c);
  }

  function onConfirm() {
    if (!pending) return;
    const { kind, client } = pending;
    setPending(null);
    if (kind === "open") void doOpen(client);
    else if (kind === "save") void doSave(client);
    else void doDelete(client);
  }

  function onTransfer(c: Client) {
    const target = transferTo[c.id];
    if (!target || target === c.sellerId) return;
    const who = members.find((m) => m.id === target)?.fullName ?? "colega";
    void run(async () => {
      await transferClient(c.id, target);
      if (useMeetingSession.getState().clientId === c.id) useMeetingSession.getState().setCanSave(target === me);
      await reload();
    }, `${c.name} agora está com ${who}.`);
  }

  function onDownload() {
    const blob = new Blob([toCsv(clients, getCatalog())], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${today()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const activeMembers = members.filter((m) => m.active && m.registered);
  const pendingText =
    pending?.kind === "open"
      ? "A tela tem alterações que não foram salvas. Abrir esta reunião vai substituí-las."
      : pending?.kind === "save"
        ? "Este cliente já tem uma reunião salva. Substituir pela tela atual?"
        : pending
          ? `Excluir ${pending.client.name} de vez? Isso apaga a reunião e a logo.`
          : "";
  const pendingAction = pending?.kind === "open" ? "Abrir mesmo assim" : pending?.kind === "save" ? "Substituir" : "Excluir de vez";

  return (
    <div role="dialog" aria-label="Clientes">
      {onClose && (
        <button type="button" onClick={onClose} className="dialog-close" aria-label="Fechar">
          ✕
        </button>
      )}
      <h2>Clientes</h2>
      <div className="clients-actions">
        <button type="button" disabled={busy} onClick={() => startEdit("new")}>
          Novo cliente
        </button>
        {isOwner && (
          <button type="button" disabled={clients.length === 0} onClick={onDownload}>
            Baixar planilha (CSV)
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={onSubmit} className="client-form">
          <fieldset>
            <legend>{editing === "new" ? "Novo cliente" : `Editar ${editing.name}`}</legend>
            <label>
              Nome
              <input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label>
              Telefone
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label>
              CNPJ
              <input inputMode="numeric" value={form.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} />
            </label>
            {duplicate && (
              <p className="hint">
                {duplicate === "você" ? "Você já tem este cliente cadastrado." : `Este cliente já está com ${duplicate}.`}
              </p>
            )}
            <label className="check">
              <input type="checkbox" checked={form.hasLocation} onChange={(e) => set("hasLocation", e.target.checked)} />
              Já tem ponto comercial
            </label>
            <label>
              Endereço
              <input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </label>
            <label>
              Tamanho do ponto (m²)
              <input inputMode="decimal" value={form.locationM2} onChange={(e) => set("locationM2", e.target.value)} />
            </label>
            <label>
              Observações
              <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </label>
            <button type="submit" disabled={busy}>
              Salvar cliente
            </button>
            <button type="button" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </fieldset>
        </form>
      )}

      {pending && (
        <div className="confirm-box">
          <p>{pendingText}</p>
          <button type="button" onClick={onConfirm}>
            {pendingAction}
          </button>
          <button type="button" onClick={() => setPending(null)}>
            Cancelar
          </button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {clients.length === 0 ? (
        <p>Nenhum cliente cadastrado ainda.</p>
      ) : (
        <ul className="client-list">
          {clients.map((c) => (
            <li key={c.id} className="client-row">
              <div>
                <strong>{c.name}</strong>
                <div>{[c.phone && formatPhone(c.phone), c.email].filter(Boolean).join(" · ")}</div>
                {isOwner && <div>Vendedor: {c.sellerName ?? "—"}</div>}
                <div>
                  {c.meetingSavedAt
                    ? `Reunião salva em ${new Date(c.meetingSavedAt).toLocaleDateString("pt-BR")}`
                    : "Sem reunião salva"}
                </div>
              </div>
              <div className="client-buttons">
                {c.meeting != null && (
                  <button type="button" disabled={busy} onClick={() => onOpen(c)}>
                    Abrir reunião
                  </button>
                )}
                {c.sellerId === me && (
                  <button type="button" disabled={busy} onClick={() => onSaveHere(c)}>
                    Salvar reunião aqui
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => startEdit(c)}>
                  Editar
                </button>
                <button type="button" disabled={busy} onClick={() => setPending({ kind: "delete", client: c })}>
                  Excluir
                </button>
                {isOwner && (
                  <>
                    <label>
                      Transferir para
                      <select
                        value={transferTo[c.id] ?? c.sellerId}
                        onChange={(e) => setTransferTo((t) => ({ ...t, [c.id]: e.target.value }))}
                      >
                        {!activeMembers.some((m) => m.id === c.sellerId) && (
                          <option value={c.sellerId}>{c.sellerName ?? "—"} (revogado)</option>
                        )}
                        {activeMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName ?? "Sem nome"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" disabled={busy} onClick={() => onTransfer(c)}>
                      Transferir
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
