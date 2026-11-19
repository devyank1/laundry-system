import { useState } from "react";
import { logoPathFor, saveMeeting, type Client } from "../clients/api";
import { useMeetingSession } from "../clients/sessionStore";
import { useProjectStore } from "../state/projectStore";

// Faixa "Reunião de <cliente>": salvar de novo sobrescreve a reunião dele.
export function MeetingBar() {
  const s = useMeetingSession();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!s.clientId || !s.clientName) return null;

  async function onSave() {
    if (!s.clientId || !s.companyId) return;
    setBusy(true);
    setMsg(null);
    const logo = useProjectStore.getState().logoDataUrl;
    const target = { id: s.clientId, companyId: s.companyId, logoPath: s.logoPath } as Client;
    try {
      await saveMeeting(target, logo);
      useMeetingSession.getState().markSaved(logo ? logoPathFor(target) : null);
      setMsg({ ok: true, text: "Reunião salva." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Não foi possível salvar a reunião." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="meeting-bar">
      <strong>Reunião de {s.clientName}</strong>
      <button type="button" disabled={busy || !s.canSave} onClick={() => void onSave()}>
        Salvar reunião
      </button>
      {!s.canSave && <span>Só o vendedor responsável salva esta reunião.</span>}
      <button type="button" aria-label="Fechar reunião" onClick={() => s.unbind()}>
        Fechar
      </button>
      {msg && <span role={msg.ok ? "status" : "alert"}>{msg.text}</span>}
    </div>
  );
}
