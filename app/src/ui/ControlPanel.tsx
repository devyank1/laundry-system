import { useSyncExternalStore } from "react";
import { useProjectStore } from "../state/projectStore";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import { useLayout } from "../state/useLayout";
import { AC_SIZES_BTU } from "../engine/constants";
import { LogoUpload } from "./LogoUpload";
import { FacadeControls } from "./FacadeControls";
import type { LayoutOrientation, SideSlot, TechAccessSide } from "../engine/types";

// Rótulos dos encaixes de mobiliário em orientation="side": dependem de qual
// parede lateral da planta recebe as máquinas.
function slotLabels(machineWall: TechAccessSide): Record<SideSlot, string> {
  const near = machineWall === "left" ? "Esquerda" : "Direita";
  const far = machineWall === "left" ? "Direita" : "Esquerda";
  return {
    farTop: `${far} cima`,
    farBottom: `${far} baixo`,
    near: `${near} (perto das máquinas)`,
  };
}

const SLOT_ORDER: SideSlot[] = ["farTop", "farBottom", "near"];

export function ControlPanel() {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const state = useProjectStore();
  const { layout } = useLayout();
  const isSide = state.orientation === "side";
  const labels = slotLabels(state.machineWall);

  function slotSelect(label: string, value: SideSlot, onChange: (slot: SideSlot) => void) {
    return (
      <label>
        {label}
        <select value={value} onChange={(e) => onChange(e.target.value as SideSlot)}>
          {SLOT_ORDER.map((slot) => (
            <option key={slot} value={slot}>
              {labels[slot]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <section aria-label="Parâmetros da lavanderia">
      <label>
        Orientação
        <select
          value={state.orientation}
          onChange={(e) => state.setOrientation(e.target.value as LayoutOrientation)}
        >
          <option value="back">Fileira na parede de fundo</option>
          <option value="side">Fileira na parede lateral</option>
        </select>
      </label>

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

      <LogoUpload />

      <FacadeControls />

      <label>
        <input type="checkbox" checked={state.doorEnabled} onChange={state.toggleDoor} />
        Porta frontal
      </label>

      {isSide && (
        <label>
          Parede das máquinas
          <select
            value={state.machineWall}
            onChange={(e) => state.setMachineWall(e.target.value as TechAccessSide)}
          >
            <option value="left">Esquerda da planta</option>
            <option value="right">Direita da planta</option>
          </select>
        </label>
      )}

      <label>
        Lado de acesso técnico
        <select
          value={state.techAccessSide}
          onChange={(e) => state.setTechAccessSide(e.target.value as TechAccessSide)}
        >
          {/* Em "side" a fileira corre de cima pra baixo na planta. */}
          <option value="left">{isSide ? "Cima" : "Esquerda"}</option>
          <option value="right">{isSide ? "Baixo" : "Direita"}</option>
        </select>
      </label>

      <label>
        <input type="checkbox" checked={state.furnitureEnabled} onChange={state.toggleFurniture} />
        Mobiliário (mesa, cadeiras, totem, ar-condicionado)
      </label>

      {state.furnitureEnabled && (
        <>
          <label>
            Lado do totem
            {isSide ? (
              // Em "side" o totem fica sempre colado numa das pontas da
              // fileira: antes da primeira máquina ou depois da última.
              <select
                value={state.totemSide}
                onChange={(e) => state.setTotemSide(e.target.value as TechAccessSide)}
              >
                <option value="left">Ao lado da primeira máquina (T1)</option>
                <option value="right">
                  Ao lado da última máquina (T{state.machines.reduce((n, m) => n + m.qty, 0)})
                </option>
              </select>
            ) : (
              <select
                value={state.totemSide}
                onChange={(e) => state.setTotemSide(e.target.value as TechAccessSide)}
              >
                <option value="left">Esquerda</option>
                <option value="right">Direita</option>
              </select>
            )}
          </label>

          {isSide && (
            <>
              {slotSelect("Lado da mesa", state.tableSlot, state.setTableSlot)}
              {slotSelect("Lado das cadeiras", state.chairsSlot, state.setChairsSlot)}
              {slotSelect("Lado do ar-condicionado", state.acSlot, state.setAcSlot)}
            </>
          )}
        </>
      )}

      {state.furnitureEnabled && !isSide && (
        <>
          <label>
            Lado da mesa
            <select
              value={state.tableSide}
              onChange={(e) => state.setTableSide(e.target.value as TechAccessSide)}
            >
              <option value="left">Esquerda</option>
              <option value="right">Direita</option>
            </select>
          </label>

          <label>
            Lado das cadeiras
            <select
              value={state.chairsSide}
              onChange={(e) => state.setChairsSide(e.target.value as TechAccessSide)}
            >
              <option value="left">Esquerda</option>
              <option value="right">Direita</option>
            </select>
          </label>

          <label>
            Lado do ar-condicionado
            <select
              value={state.acSide}
              onChange={(e) => state.setAcSide(e.target.value as TechAccessSide)}
            >
              <option value="left">Esquerda</option>
              <option value="right">Direita</option>
            </select>
          </label>
        </>
      )}

      {state.furnitureEnabled && (
        <label>
          Ar-condicionado (BTU/h)
          {layout && (
            <p>
              Sugestão automática: {layout.acSuggestedBTU.toLocaleString("pt-BR")} BTU/h (área
              social {layout.salonAreaM2.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m²)
            </p>
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
