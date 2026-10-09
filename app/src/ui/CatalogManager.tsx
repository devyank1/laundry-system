import { useState, useSyncExternalStore, type ChangeEvent } from "react";
import {
  addMachine,
  deleteMachine,
  exportCatalogJSON,
  getCatalog,
  importCatalogJSON,
  restoreDefaults,
  subscribeCatalog,
} from "../catalog/store";
import { useProjectStore } from "../state/projectStore";
import type { CatalogMachine } from "../engine/types";

const emptyMachine: CatalogMachine = {
  id: "",
  brand: "",
  model: "",
  type: "stack",
  widthMm: 0,
  depthMm: 0,
  heightMm: 0,
};

export function CatalogManager({ onClose }: { onClose: () => void }) {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const [draft, setDraft] = useState<CatalogMachine>(emptyMachine);
  const [formError, setFormError] = useState<string | null>(null);

  function handleAdd(): void {
    if (!draft.id || !draft.brand || !draft.model) {
      setFormError("Preencha ID, marca e modelo.");
      return;
    }
    if (catalog.some((m) => m.id === draft.id)) {
      setFormError(`Já existe uma máquina com o ID "${draft.id}".`);
      return;
    }
    if (draft.widthMm <= 0 || draft.depthMm <= 0 || draft.heightMm <= 0) {
      setFormError("Largura, profundidade e altura devem ser maiores que zero.");
      return;
    }
    setFormError(null);
    addMachine(draft);
    setDraft(emptyMachine);
  }

  function handleImport(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        importCatalogJSON(text);
        setFormError(null);
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : "Falha ao importar o arquivo.");
      });
  }

  function handleExport(): void {
    const json = exportCatalogJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "catalogo-maquinas.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div role="dialog" aria-label="Gerenciar catálogo de máquinas">
      <button type="button" onClick={onClose}>
        Fechar
      </button>
      <button type="button" onClick={() => restoreDefaults()}>
        Restaurar padrão
      </button>
      <button type="button" onClick={handleExport}>
        Exportar JSON
      </button>
      <label>
        Importar JSON
        <input type="file" accept="application/json" onChange={handleImport} />
      </label>

      <ul>
        {catalog.map((m) => (
          <li key={m.id}>
            {m.brand} {m.model} — {m.widthMm}×{m.depthMm}×{m.heightMm}mm
            <button
              type="button"
              onClick={() => {
                deleteMachine(m.id);
                useProjectStore.getState().removeMachine(m.id);
              }}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      <fieldset>
        <legend>Nova máquina</legend>
        <label>
          ID
          <input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
        </label>
        <label>
          Marca
          <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
        </label>
        <label>
          Modelo
          <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
        </label>
        <label>
          Tipo
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as CatalogMachine["type"] })}
          >
            <option value="lavadora">Lavadora</option>
            <option value="secadora">Secadora</option>
            <option value="stack">Stack (lavadora + secadora)</option>
          </select>
        </label>
        <label>
          Largura (mm)
          <input
            type="number"
            value={draft.widthMm}
            onChange={(e) => setDraft({ ...draft, widthMm: Number(e.target.value) })}
          />
        </label>
        <label>
          Profundidade (mm)
          <input
            type="number"
            value={draft.depthMm}
            onChange={(e) => setDraft({ ...draft, depthMm: Number(e.target.value) })}
          />
        </label>
        <label>
          Altura (mm)
          <input
            type="number"
            value={draft.heightMm}
            onChange={(e) => setDraft({ ...draft, heightMm: Number(e.target.value) })}
          />
        </label>
        {formError && <p role="alert">{formError}</p>}
        <button type="button" onClick={handleAdd}>
          Adicionar
        </button>
      </fieldset>
    </div>
  );
}
