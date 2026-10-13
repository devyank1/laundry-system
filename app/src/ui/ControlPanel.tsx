import { useSyncExternalStore } from "react";
import { useProjectStore } from "../state/projectStore";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import { useLayout } from "../state/useLayout";
import { AC_SIZES_BTU } from "../engine/constants";
import type { TechAccessSide } from "../engine/types";

export function ControlPanel() {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const state = useProjectStore();
  const { layout } = useLayout();

  return (
    <section aria-label="Parâmetros da lavanderia">
      <label>
        Área Total (m²)
        <input
          type="number"
          step={0.5}
          min={0}
          disabled={state.roomWidthMm <= 0}
          value={Math.round((state.roomWidthMm * state.roomDepthMm) / 10_000) / 100}
          onChange={(e) => state.setRoomAreaM2(Number(e.target.value))}
        />
      </label>

      <label>
        Largura (m)
        <input
          type="number"
          step={0.1}
          min={0.1}
          value={state.roomWidthMm / 1000}
          onChange={(e) => state.setRoomWidthMm(Number(e.target.value) * 1000)}
        />
      </label>

      <label>
        Comprimento (m)
        <input
          type="number"
          step={0.1}
          min={0.1}
          value={state.roomDepthMm / 1000}
          onChange={(e) => state.setRoomDepthMm(Number(e.target.value) * 1000)}
        />
      </label>

      <label>
        Pé-direito (m)
        <input
          type="number"
          step={0.1}
          min={0.1}
          value={state.ceilingHeightMm / 1000}
          onChange={(e) => state.setCeilingHeightMm(Number(e.target.value) * 1000)}
        />
      </label>

      <fieldset>
        <legend>Máquinas</legend>
        {catalog.map((machine) => {
          const selection = state.machines.find((m) => m.catalogId === machine.id);
          return (
            <label key={machine.id}>
              {machine.brand} {machine.model}
              <input
                type="number"
                min={0}
                value={selection?.qty ?? 0}
                onChange={(e) => state.setMachineQty(machine.id, Number(e.target.value))}
              />
            </label>
          );
        })}
      </fieldset>

      <label>
        <input type="checkbox" checked={state.doorEnabled} onChange={state.toggleDoor} />
        Porta frontal
      </label>

      <label>
        Lado de acesso técnico
        <select
          value={state.techAccessSide}
          onChange={(e) => state.setTechAccessSide(e.target.value as TechAccessSide)}
        >
          <option value="left">Esquerda</option>
          <option value="right">Direita</option>
        </select>
      </label>

      <label>
        <input type="checkbox" checked={state.furnitureEnabled} onChange={state.toggleFurniture} />
        Mobiliário (mesa, cadeiras, totem, ar-condicionado)
      </label>

      {state.furnitureEnabled && (
        <label>
          Ar-condicionado (BTU/h)
          {layout && (
            <p>Sugestão automática: {layout.acSuggestedBTU.toLocaleString("pt-BR")} BTU/h</p>
          )}
          <select
            value={state.acOverrideBTU ?? "auto"}
            onChange={(e) =>
              state.setAcOverrideBTU(e.target.value === "auto" ? null : Number(e.target.value))
            }
          >
            <option value="auto">Automático (sugerido)</option>
            {AC_SIZES_BTU.map((btu) => (
              <option key={btu} value={btu}>
                {btu.toLocaleString("pt-BR")} BTU/h
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
