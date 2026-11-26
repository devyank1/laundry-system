import { useState, type FormEvent } from "react";
import { OBRA_STEPS, type ObraStep } from "../obra/steps";
import { EXTRA_MAX, EXTRA_MAX_LEN, canComplete, currentIndex, useObraStore } from "../obra/obraStore";

function dateBR(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Lista livre de materiais extras (pisos etc.) da etapa de compras.
function ExtraMaterials({ editable }: { editable: boolean }) {
  const extras = useObraStore((s) => s.extras);
  const addExtra = useObraStore((s) => s.addExtra);
  const removeExtra = useObraStore((s) => s.removeExtra);
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    addExtra(text);
    setText("");
  };
  if (!editable && extras.length === 0) return null;
  return (
    <div className="obra-extras">
      <span className="obra-check-count">Materiais extras</span>
      {extras.length > 0 && (
        <ul>
          {extras.map((m, i) => (
            <li key={`${i}-${m}`}>
              <span>{m}</span>
              {editable && (
                <button type="button" className="obra-extra-remove" aria-label={`Remover ${m}`} onClick={() => removeExtra(i)}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && extras.length < EXTRA_MAX && (
        <form onSubmit={submit}>
          <input
            type="text"
            value={text}
            maxLength={EXTRA_MAX_LEN}
            placeholder="Ex.: piso vinílico"
            aria-label="Material extra"
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" disabled={!text.trim()}>
            + Adicionar
          </button>
        </form>
      )}
    </div>
  );
}

function Checklist({ step, state }: { step: ObraStep; state: string }) {
  const checked = useObraStore((s) => s.checked);
  const toggle = useObraStore((s) => s.toggle);
  const list = step.checklist ?? [];
  if (list.length === 0) return null;
  const isOn = (id: string) => checked.includes(id) || (state === "done" && !step.optionalChecklist);
  const marked = list.filter((c) => isOn(c.id)).length;
  return (
    <div className="obra-checklist">
      <span className="obra-check-count">{`${marked} de ${list.length}${step.optionalChecklist ? " (opcionais)" : ""}`}</span>
      <ul>
        {list.map((c, k) => (
          <li key={c.id}>
            <label>
              <input type="checkbox" checked={isOn(c.id)} disabled={state !== "current"} onChange={() => toggle(c.id)} />
              <span className="obra-check-letter">{String.fromCharCode(65 + k)}</span>
              <span>{c.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Etapas da obra do cliente: concluídas em ordem; a atual tem o botão.
export function DiarioObra() {
  const doneAt = useObraStore((s) => s.doneAt);
  const checked = useObraStore((s) => s.checked);
  const complete = useObraStore((s) => s.complete);
  const undo = useObraStore((s) => s.undo);
  const total = OBRA_STEPS.length;
  const current = currentIndex(doneAt);
  const done = OBRA_STEPS.filter((s) => doneAt[s.id]).length;

  return (
    <section className="obra">
      <header className="obra-head">
        <h2>Diário de Obra</h2>
        <p className="obra-count">{`${done} de ${total} etapas concluídas`}</p>
        <div className="obra-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
        {done === total && <p className="obra-finished">Obra concluída!</p>}
      </header>
      <ol className="obra-steps">
        {OBRA_STEPS.map((step, i) => {
          const at = doneAt[step.id];
          const state = at ? "done" : i === current ? "current" : "todo";
          const ready = canComplete(step, checked);
          return (
            <li key={step.id} data-state={state}>
              <span className="obra-mark" aria-hidden="true">{state === "done" ? "✓" : i}</span>
              <div className="obra-body">
                <strong>{step.title}</strong>
                {step.goal && <span className="obra-goal">{step.goal}</span>}
                {step.deadline && <span className="obra-deadline">{step.deadline}</span>}
                <Checklist step={step} state={state} />
                {step.extras && <ExtraMaterials editable={state !== "todo"} />}
                {at && <span className="obra-date">{`Concluída em ${dateBR(at)}`}</span>}
                {at && step.image && <img className="obra-image" src={step.image} alt={step.title} loading="lazy" />}
              </div>
              {state === "current" && (
                <button
                  type="button"
                  className="primary"
                  disabled={!ready}
                  title={ready ? undefined : "Marque todos os itens do checklist"}
                  onClick={() => complete()}
                >
                  Concluir etapa
                </button>
              )}
              {at && i === current - 1 && (
                <button type="button" onClick={() => undo()}>
                  Desfazer
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
