import { useState } from "react";
import { useProjectStore, type LogoSideColor, type LogoStyle } from "../state/projectStore";
import { NotPngError, readPngAsDataUrl } from "./logoFile";

// Logo do protótipo/local: PNG (fundo transparente), aparece no 3D no
// drywall em cima das máquinas. Cada projeto pode ter uma logo diferente.
export function LogoUpload() {
  const logoDataUrl = useProjectStore((s) => s.logoDataUrl);
  const setLogoDataUrl = useProjectStore((s) => s.setLogoDataUrl);
  const logoStyle = useProjectStore((s) => s.logoStyle);
  const setLogoStyle = useProjectStore((s) => s.setLogoStyle);
  const logoDepthMm = useProjectStore((s) => s.logoDepthMm);
  const setLogoDepthMm = useProjectStore((s) => s.setLogoDepthMm);
  const logoSideColor = useProjectStore((s) => s.logoSideColor);
  const setLogoSideColor = useProjectStore((s) => s.setLogoSideColor);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setLogoDataUrl(await readPngAsDataUrl(file));
      setError(null);
    } catch (e) {
      setError(e instanceof NotPngError ? e.message : "Não foi possível ler a imagem.");
    }
  }

  return (
    <fieldset>
      <legend>Logo do local</legend>
      <label>
        Enviar logo (PNG)
        <input
          type="file"
          accept="image/png"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = ""; // permite reenviar o mesmo arquivo
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {logoDataUrl && (
        <>
          <img src={logoDataUrl} alt="Logo atual" style={{ maxWidth: "100%", maxHeight: 80 }} />

          <label>
            Estilo da logo
            <select value={logoStyle} onChange={(e) => setLogoStyle(e.target.value as LogoStyle)}>
              <option value="3d">Letreiro 3D (com volume)</option>
              <option value="flat">Adesivo (plano)</option>
            </select>
          </label>

          {logoStyle === "3d" && (
            <>
              <label>
                Espessura do letreiro (cm)
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={logoDepthMm / 10}
                  onChange={(e) => {
                    const cm = Number(e.target.value);
                    if (cm > 0) setLogoDepthMm(Math.min(cm, 10) * 10);
                  }}
                />
              </label>
              <label>
                Cor da lateral
                <select
                  value={logoSideColor}
                  onChange={(e) => setLogoSideColor(e.target.value as LogoSideColor)}
                >
                  <option value="white">Branco</option>
                  <option value="black">Preto</option>
                  <option value="steel">Inox</option>
                </select>
              </label>
            </>
          )}

          <button type="button" onClick={() => setLogoDataUrl(null)}>
            Remover logo
          </button>
        </>
      )}
    </fieldset>
  );
}
