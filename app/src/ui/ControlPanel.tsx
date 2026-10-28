import { useSyncExternalStore } from "react";
import { useProjectStore } from "../state/projectStore";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import { useLayout } from "../state/useLayout";
import { AC_SIZES_BTU } from "../engine/constants";
import { LogoUpload } from "./LogoUpload";
import { FacadeControls } from "./FacadeControls";
import { isPremium } from "../engine/layout";
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

// `show3dOptions`: logo, fachada e iluminação só mudam o 3D; fora da aba 3D
// ficam escondidos pra barra lateral mostrar só o que vale pra tela atual.
export function ControlPanel({ show3dOptions = true }: { show3dOptions?: boolean }) {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const state = useProjectStore();
  const { layout } = useLayout();
  const isSide = state.orientation === "side";
  const labels = slotLabels(state.machineWall);
  // Lavanderia premium (>= 30 m²): ganha o balcão alto com banquetas.
  const premium = isPremium(state);

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

  // Select de lado esquerda/direita (fileira no fundo).
  function sideSelect(
    label: string,
    value: TechAccessSide,
    onChange: (side: TechAccessSide) => void
  ) {
    return (
      <label>
        {label}
        <select value={value} onChange={(e) => onChange(e.target.value as TechAccessSide)}>
          <option value="left">Esquerda</option>
          <option value="right">Direita</option>
        </select>
      </label>
    );
  }

  const hasTechInfo = Boolean(layout?.exhaust || layout?.electrical || layout?.hydraulics);

  // Cada assunto num bloco próprio (fieldset com título), na ordem em que a
  // loja é montada: ambiente → máquinas → mobiliário → identidade visual.
  return (
    <section aria-label="Parâmetros da lavanderia">
      <fieldset>
        <legend>Ambiente</legend>
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

        <label>
          <input type="checkbox" checked={state.doorEnabled} onChange={state.toggleDoor} />
          Porta frontal
        </label>
      </fieldset>

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
      </fieldset>

      <fieldset>
        <legend>Mobiliário</legend>
        <label>
          <input type="checkbox" checked={state.furnitureEnabled} onChange={state.toggleFurniture} />
          Incluir mesa, cadeiras, totem e ar-condicionado{premium ? " (+ balcão premium)" : ""}
        </label>
      </fieldset>

      {state.furnitureEnabled && (
        <>
          <fieldset>
            <legend>Totem de pagamento</legend>
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
          </fieldset>

          <fieldset>
            <legend>Mesa</legend>
            {isSide
              ? slotSelect("Lado da mesa", state.tableSlot, state.setTableSlot)
              : sideSelect("Lado da mesa", state.tableSide, state.setTableSide)}
          </fieldset>

          <fieldset>
            <legend>Cadeiras</legend>
            {isSide
              ? slotSelect("Lado das cadeiras", state.chairsSlot, state.setChairsSlot)
              : sideSelect("Lado das cadeiras", state.chairsSide, state.setChairsSide)}
          </fieldset>

          <fieldset>
            <legend>Ar-condicionado</legend>
            {isSide
              ? slotSelect("Lado do ar-condicionado", state.acSlot, state.setAcSlot)
              : sideSelect("Lado do ar-condicionado", state.acSide, state.setAcSide)}
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
          </fieldset>

          {premium && (
            <fieldset>
              <legend>Balcão premium</legend>
              {isSide
                ? slotSelect("Lado do balcão", state.counterSlot, state.setCounterSlot)
                : sideSelect("Lado do balcão", state.counterSide, state.setCounterSide)}
            </fieldset>
          )}
        </>
      )}

      {show3dOptions && (
        <>
          <LogoUpload />
          <FacadeControls />
        </>
      )}

      {hasTechInfo && (
        <fieldset>
          <legend>Informações técnicas</legend>
          {layout?.exhaust && (
            <p data-exhaust-info role={layout.exhaust.withinLimit ? undefined : "alert"}>
              Exaustão das secadoras: duto Ø{layout.exhaust.outletDiameterMm} mm,{" "}
              {(layout.exhaust.lengthMm / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m
              até a saída pela parede de trás (máx.{" "}
              {(layout.exhaust.maxLengthMm / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m).
              {!layout.exhaust.withinLimit && " Acima do limite do manual: reduza a fileira ou o trajeto."}
            </p>
          )}

          {layout?.electrical && (
            <p data-electrical-info>
              Elétrica suspensa: {layout.electrical.summary.machines} perfilado(s) de alumínio, com{" "}
              {layout.electrical.summary.dryerSockets} tomada(s) Steck de secadora (
              {layout.electrical.machines[0].dryerSocket.amperage ?? "?"} A no 1º maquinário),{" "}
              {layout.electrical.summary.sockets220} tomadas 220 V (lavadora + 2 dosadoras, caixa vertical) e{" "}
              {layout.electrical.summary.customerOutlets} tomadas 127 V para clientes, entre as cadeiras.
            </p>
          )}

          {layout?.hydraulics && (
            <p data-hydraulics-info>
              Hidráulica: barramento Ø{layout.hydraulics.summary.mainDiameterMm} mm (
              {layout.hydraulics.summary.supplyFlowLpm} L/min, pressão de{" "}
              {layout.hydraulics.summary.pressureKpa.min} a {layout.hydraulics.summary.pressureKpa.max} kPa
              com pressurizador); esgoto suspenso Ø
              {Math.round(layout.hydraulics.summary.drainDiameterMm)} mm,{" "}
              {layout.hydraulics.summary.drainFlowLpm} L/min de dreno; dosagem:{" "}
              {layout.hydraulics.summary.dosingPumps} bombas dosadoras (par por lavadora).
            </p>
          )}
        </fieldset>
      )}
    </section>
  );
}
