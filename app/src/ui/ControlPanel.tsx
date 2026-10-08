import { useSyncExternalStore } from "react";
import { useProjectStore } from "../state/projectStore";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import type { TechAccessSide } from "../engine/types";

export function ControlPanel() {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const state = useProjectStore();

  return (
    <section aria-label="Parâmetros da lavanderia">
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
        Profundidade (m)
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
    </section>
  );
}
