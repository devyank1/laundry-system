import { OBRA_STEPS } from "../obra/steps";
import { useObraStore } from "../obra/obraStore";

function dateBR(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Etapas da obra do cliente: concluídas em ordem; a atual tem o botão.
export function DiarioObra() {
  const doneAt = useObraStore((s) => s.doneAt);
  const complete = useObraStore((s) => s.complete);
  const undo = useObraStore((s) => s.undo);
  const total = OBRA_STEPS.length;
  const done = doneAt.length;

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
          const state = i < done ? "done" : i === done ? "current" : "todo";
          return (
            <li key={step.n} data-state={state}>
              <span className="obra-mark" aria-hidden="true">{state === "done" ? "✓" : step.n}</span>
              <div className="obra-body">
                <strong>{step.title}</strong>
                {step.goal && <span className="obra-goal">{step.goal}</span>}
                {step.deadline && <span className="obra-deadline">{step.deadline}</span>}
                {state === "done" && <span className="obra-date">{`Concluída em ${dateBR(doneAt[i])}`}</span>}
                {state === "done" && step.image && <img className="obra-image" src={step.image} alt={step.title} loading="lazy" />}
              </div>
              {state === "current" && (
                <button type="button" className="primary" onClick={() => complete()}>
                  Concluir etapa
                </button>
              )}
              {state === "done" && i === done - 1 && (
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
