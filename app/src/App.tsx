import { useState } from "react";
import { ControlPanel } from "./ui/ControlPanel";
import { ViolationsPanel } from "./ui/ViolationsPanel";
import { CatalogManager } from "./ui/CatalogManager";
import { FloorPlan } from "./viewer2d/FloorPlan";
import { Scene } from "./viewer3d/Scene";
import { useLayout } from "./state/useLayout";
import { exportFloorPlanPDF, exportFloorPlanPNG } from "./export/export2d";
import { exportSceneScreenshot } from "./export/export3d";
import "./App.css";

export function App() {
  const { layout, violations } = useLayout();
  const [tab, setTab] = useState<"2d" | "3d">("2d");
  const [showCatalog, setShowCatalog] = useState(false);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

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
          <Scene layout={layout} onCanvasReady={setCanvasEl} />
          <div className="export-actions">
            <button
              type="button"
              disabled={!canExport || !canvasEl}
              onClick={() => canvasEl && exportSceneScreenshot(canvasEl)}
            >
              Baixar imagem 3D
            </button>
          </div>
        </>
      )}
    </div>
  );
}
