import { Suspense, lazy, useEffect, useState, type CSSProperties } from "react";
import { ControlPanel } from "./ui/ControlPanel";
import { ViolationsPanel } from "./ui/ViolationsPanel";
import { CatalogManager } from "./ui/CatalogManager";
import { RoiCalculator } from "./roi/RoiCalculator";
import { InsightsCalculator } from "./insights/InsightsCalculator";
import {
  IconChart,
  IconCube,
  IconDownload,
  IconEye,
  IconOrbit,
  IconPlan,
  IconSettings,
  IconSignal,
  IconSparkles,
  LogoMark,
} from "./ui/icons";
import { FloorPlan, PLAN_SHEETS, type PlanSheet } from "./viewer2d/FloorPlan";
import { useLayout } from "./state/useLayout";
import { useProjectStore } from "./state/projectStore";
import { exportFloorPlanPDF, exportFloorPlanPNG } from "./export/export2d";
import { exportSceneScreenshot } from "./export/export3d";
import { drywallColorFor } from "./viewer3d/colors";
import { usePlantSync } from "./plantLink";
import "./App.css";

const PLAN_ZOOMS = [1, 1.5, 2, 3];

// O 3D (three + react-three-fiber + drei, ~800 kB) só é baixado quando a aba
// 3D é aberta; a planta 2D abre sem ele. `loadScene` também serve pra aquecer
// o download (ao passar o mouse no botão e quando o navegador está ocioso).
const loadScene = () => import("./viewer3d/Scene");
const Scene = lazy(() => loadScene().then((m) => ({ default: m.Scene })));

export function App() {
  const { layout, violations } = useLayout();
  // ROI e Conectividade seguem as máquinas da planta.
  usePlantSync();
  // Com a 2D já na tela e o navegador ocioso, baixa o 3D pra abrir sem espera.
  useEffect(() => {
    const idle = (window as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const timer = idle ? idle(() => void loadScene()) : window.setTimeout(() => void loadScene(), 1500);
    return () => {
      if (!idle) window.clearTimeout(timer);
    };
  }, []);
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
  const [tab, setTab] = useState<"2d" | "3d" | "roi" | "insights">("2d");
  const [sheet, setSheet] = useState<PlanSheet>("layout");
  // Zoom da planta 2D (o desenho alarga e a área rola).
  const [planZoom, setPlanZoom] = useState(1);
  const [showCatalog, setShowCatalog] = useState(false);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  // "Visão do cliente": número = passeio rodando (novo número reinicia); null = órbita livre.
  const [tourRun, setTourRun] = useState<number | null>(null);

  // Inauguração mostra a loja de verdade: a fachada (e o teto) entram junto.
  const facadeOn = facadeVisible || inauguracao;
  const canExport = layout !== null && violations.length === 0;

  return (
    // ROI e Conectividade não usam os parâmetros da planta: sem barra lateral.
    <div className={tab === "roi" || tab === "insights" ? "app app-wide" : "app"}>
      <header className="topbar">
        <div className="brand">
          <LogoMark />
          <div>
            <h1>Configurador de Lavanderia</h1>
            <p>Planta, instalações e retorno do investimento</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button type="button" aria-label="Gerenciar máquinas" title="Gerenciar máquinas" onClick={() => setShowCatalog(true)}>
            <IconSettings />
            Gerenciar máquinas
          </button>
        </div>
      </header>

      {tab !== "roi" && tab !== "insights" && (
        <aside className="sidebar">
          <div className="sidebar-head">
            <h2>Parâmetros do projeto</h2>
            <p>As plantas e o 3D se atualizam na hora.</p>
          </div>
          <ControlPanel show3dOptions={tab === "3d"} />
        </aside>
      )}

      {showCatalog && <CatalogManager onClose={() => setShowCatalog(false)} />}

      <main className="workspace">
      <ViolationsPanel violations={violations} />

      <div className="tabs-row">
      <nav className="tabs" aria-label="Visualizações">
        <button type="button" aria-pressed={tab === "2d"} onClick={() => setTab("2d")}>
          <IconPlan />
          Planta 2D
        </button>
        <button
          type="button"
          aria-pressed={tab === "3d"}
          onClick={() => setTab("3d")}
          onMouseEnter={() => void loadScene()}
          onFocus={() => void loadScene()}
        >
          <IconCube />
          Planta 3D
        </button>
        <button type="button" aria-pressed={tab === "roi"} onClick={() => setTab("roi")}>
          <IconChart />
          Retorno (ROI)
        </button>
        <button type="button" aria-pressed={tab === "insights"} onClick={() => setTab("insights")}>
          <IconSignal />
          Conectividade
        </button>
      </nav>
      {layout && tab === "2d" && (
        <div className="export-actions tabs-actions">
          <button
            type="button"
            title="Baixar PNG"
            disabled={!canExport || !svgEl}
            onClick={() => svgEl && exportFloorPlanPNG(svgEl, `planta-${sheet}.png`)}
          >
            <IconDownload />
            Baixar PNG
          </button>
          <button
            type="button"
            title="Baixar PDF"
            disabled={!canExport || !svgEl}
            onClick={() =>
              svgEl &&
              exportFloorPlanPDF(
                svgEl,
                {
                  projectName: "Minha Lavanderia",
                  areaM2: (layout.roomWidthMm / 1000) * (layout.roomDepthMm / 1000),
                },
                `planta-${sheet}.pdf`
              )
            }
          >
            <IconDownload />
            Baixar PDF
          </button>
        </div>
      )}
      {layout && tab === "3d" && (
        <div className="export-actions tabs-actions tabs-actions-many">
          <button
            type="button"
            disabled={!canExport || !canvasEl}
            title="Baixar imagem 3D"
            onClick={() => canvasEl && exportSceneScreenshot(canvasEl)}
          >
            <IconDownload />
            Baixar imagem 3D
          </button>
          <button type="button" title="Visão do cliente" onClick={() => setTourRun((n) => (n ?? 0) + 1)}>
            <IconEye />
            {tourRun === null ? "Visão do cliente" : "Repetir visão do cliente"}
          </button>
          <button type="button" title="Modo inauguração" aria-pressed={inauguracao} onClick={toggleInauguracao}>
            <IconSparkles />
            Modo inauguração
          </button>
          {tourRun !== null && (
            <button type="button" title="Visão livre" onClick={() => setTourRun(null)}>
              <IconOrbit />
              Visão livre
            </button>
          )}
        </div>
      )}
      </div>

      {tab === "roi" && <RoiCalculator />}
      {tab === "insights" && <InsightsCalculator />}

      {!layout && tab !== "roi" && tab !== "insights" && (
        <p className="empty-state">Ajuste as dimensões para visualizar a planta.</p>
      )}

      {layout && tab === "2d" && (
        <>
          <div className="plan2d">
          <div className="plan-toolbar">
          <div className="sheet-tabs" role="tablist" aria-label="Pranchas">
            {PLAN_SHEETS.map((sh) => (
              <button
                key={sh.id}
                type="button"
                role="tab"
                aria-selected={sheet === sh.id}
                onClick={() => setSheet(sh.id)}
              >
                {sh.label}
              </button>
            ))}
          </div>
          <div className="plan-zoom" role="group" aria-label="Zoom da planta">
            <button
              type="button"
              aria-label="Diminuir zoom"
              disabled={planZoom <= PLAN_ZOOMS[0]}
              onClick={() => setPlanZoom((z) => PLAN_ZOOMS[Math.max(0, PLAN_ZOOMS.indexOf(z) - 1)])}
            >
              −
            </button>
            <span>{`${Math.round(planZoom * 100)}%`}</span>
            <button
              type="button"
              aria-label="Aumentar zoom"
              disabled={planZoom >= PLAN_ZOOMS[PLAN_ZOOMS.length - 1]}
              onClick={() => setPlanZoom((z) => PLAN_ZOOMS[Math.min(PLAN_ZOOMS.length - 1, PLAN_ZOOMS.indexOf(z) + 1)])}
            >
              +
            </button>
          </div>
          </div>
          <div className="plan-viewport" style={{ "--plan-zoom": planZoom } as CSSProperties}>
            <FloorPlan ref={setSvgEl} layout={layout} sheet={sheet} />
          </div>
          </div>
        </>
      )}

      {layout && tab === "3d" && (
        <Suspense fallback={<div className="scene3d-placeholder" role="status">Carregando o 3D…</div>}>
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
        </Suspense>
      )}
      </main>
    </div>
  );
}
