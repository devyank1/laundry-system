import { useState } from "react";
import { ControlPanel } from "./ui/ControlPanel";
import { ViolationsPanel } from "./ui/ViolationsPanel";
import { CatalogManager } from "./ui/CatalogManager";
import { FloorPlan } from "./viewer2d/FloorPlan";
import { Scene } from "./viewer3d/Scene";
import { useLayout } from "./state/useLayout";
import { useProjectStore } from "./state/projectStore";
import { exportFloorPlanPDF, exportFloorPlanPNG } from "./export/export2d";
import { exportSceneScreenshot } from "./export/export3d";
import { drywallColorFor } from "./viewer3d/colors";
import "./App.css";

export function App() {
  const { layout, violations } = useLayout();
  const logoDataUrl = useProjectStore((s) => s.logoDataUrl);
  const logoStyle = useProjectStore((s) => s.logoStyle);
  const logoDepthMm = useProjectStore((s) => s.logoDepthMm);
  const logoSideColor = useProjectStore((s) => s.logoSideColor);
  const facadeVisible = useProjectStore((s) => s.facadeVisible);
  const facadeColor = useProjectStore((s) => s.facadeColor);
  const facadeSignColor = useProjectStore((s) => s.facadeSignColor);
  const sceneLighting = useProjectStore((s) => s.sceneLighting);
  const roofVisible = useProjectStore((s) => s.roofVisible);
  const inauguracao = useProjectStore((s) => s.inauguracao);
  const toggleInauguracao = useProjectStore((s) => s.toggleInauguracao);
  const [tab, setTab] = useState<"2d" | "3d">("2d");
  const [showCatalog, setShowCatalog] = useState(false);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  // "Visão do cliente": número = passeio rodando (novo número reinicia); null = órbita livre.
  const [tourRun, setTourRun] = useState<number | null>(null);

  // Inauguração mostra a loja de verdade: a fachada (e o teto) entram junto.
  const facadeOn = facadeVisible || inauguracao;
  const canExport = layout !== null && violations.length === 0;

  return (
    <div className="app">
      <header>
        <h1>Configurador de Lavanderia</h1>
        <p>Monte a planta da sua lavanderia e baixe em 2D ou 3D.</p>
      </header>

      <ControlPanel />
      <ViolationsPanel violations={violations} />

      <button type="button" onClick={() => setShowCatalog(true)}>
        Gerenciar máquinas
      </button>
      {showCatalog && <CatalogManager onClose={() => setShowCatalog(false)} />}

      <nav>
        <button type="button" onClick={() => setTab("2d")}>
          Planta 2D
        </button>
        <button type="button" onClick={() => setTab("3d")}>
          Planta 3D
        </button>
      </nav>

      {!layout && <p>Ajuste as dimensões para visualizar a planta.</p>}

      {layout && tab === "2d" && (
        <>
          <FloorPlan ref={setSvgEl} layout={layout} />
          <div className="export-actions">
            <button
              type="button"
              disabled={!canExport || !svgEl}
              onClick={() => svgEl && exportFloorPlanPNG(svgEl)}
            >
              Baixar PNG
            </button>
            <button
              type="button"
              disabled={!canExport || !svgEl}
              onClick={() =>
                svgEl &&
                exportFloorPlanPDF(svgEl, {
                  projectName: "Minha Lavanderia",
                  areaM2: (layout.roomWidthMm / 1000) * (layout.roomDepthMm / 1000),
                })
              }
            >
              Baixar PDF
            </button>
          </div>
        </>
      )}

      {layout && tab === "3d" && (
        <>
          <Scene
            layout={layout}
            logo={
              logoDataUrl
                ? { url: logoDataUrl, style: logoStyle, depthMm: logoDepthMm, sideColor: logoSideColor }
                : null
            }
            facade={
              facadeOn ? { wallColor: facadeColor, signColor: facadeSignColor } : null
            }
            drywallColor={drywallColorFor(facadeColor)}
            lighting={sceneLighting}
            showRoof={facadeOn && roofVisible}
            inauguracao={inauguracao}
            tourRun={tourRun}
            onCanvasReady={setCanvasEl}
          />
          <div className="export-actions">
            <button
              type="button"
              disabled={!canExport || !canvasEl}
              onClick={() => canvasEl && exportSceneScreenshot(canvasEl)}
            >
              Baixar imagem 3D
            </button>
            <button type="button" onClick={() => setTourRun((n) => (n ?? 0) + 1)}>
              {tourRun === null ? "Visão do cliente" : "Repetir visão do cliente"}
            </button>
            <button type="button" aria-pressed={inauguracao} onClick={toggleInauguracao}>
              Modo inauguração
            </button>
            {tourRun !== null && (
              <button type="button" onClick={() => setTourRun(null)}>
                Visão livre
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
