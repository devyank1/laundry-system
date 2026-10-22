import { useState } from "react";
import { useProjectStore } from "../state/projectStore";
import type { SceneLighting } from "../viewer3d/lighting";
import { normalizeHex } from "./hexColor";

// Campo de cor: digita o HEX depois do "#" (ou escolhe no seletor) e a cor
// muda na hora. Texto inválido não altera nada; ao sair do campo, volta pra
// cor atual.
function HexColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value.replace(/^#/, "");
  const invalid = draft !== null && normalizeHex(draft) === null;

  return (
    <label>
      {label}
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="color"
          aria-label={`${label} (seletor)`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 40, padding: 0 }}
        />
        <span aria-hidden>#</span>
        <input
          type="text"
          aria-label={`${label} (HEX)`}
          aria-invalid={invalid}
          maxLength={7}
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          onBlur={() => setDraft(null)}
        />
      </span>
    </label>
  );
}

export function FacadeControls() {
  const visible = useProjectStore((s) => s.facadeVisible);
  const toggle = useProjectStore((s) => s.toggleFacade);
  const color = useProjectStore((s) => s.facadeColor);
  const setColor = useProjectStore((s) => s.setFacadeColor);
  const signColor = useProjectStore((s) => s.facadeSignColor);
  const setSignColor = useProjectStore((s) => s.setFacadeSignColor);
  const lighting = useProjectStore((s) => s.sceneLighting);
  const setLighting = useProjectStore((s) => s.setSceneLighting);
  const roofVisible = useProjectStore((s) => s.roofVisible);
  const toggleRoof = useProjectStore((s) => s.toggleRoof);

  return (
    <>
      <fieldset>
        <legend>Fachada (3D)</legend>
        <label>
          <input type="checkbox" checked={visible} onChange={toggle} />
          Mostrar fachada
        </label>
        {visible && (
          <>
            <HexColorField label="Cor da fachada" value={color} onChange={setColor} />
            <HexColorField label="Cor do painel do letreiro" value={signColor} onChange={setSignColor} />
            {/* Sem fachada o teto sai junto (loja aberta pra ver de cima). */}
            <label>
              <input type="checkbox" checked={roofVisible} onChange={toggleRoof} />
              Mostrar teto por fora
            </label>
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>Iluminação (3D)</legend>
        <label>
          Iluminação
          <select value={lighting} onChange={(e) => setLighting(e.target.value as SceneLighting)}>
            <option value="day">Dia</option>
            <option value="night">Noite (luzes da loja acesas)</option>
          </select>
        </label>
      </fieldset>
    </>
  );
}
