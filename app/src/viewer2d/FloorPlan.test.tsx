import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloorPlan } from "./FloorPlan";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, ProjectState } from "../engine/types";

const catalog: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
  },
];

const state: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 4200,
  orientation: "back",
  ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 2 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  totemSide: "left",
  tableSide: "left",
  chairsSide: "left",
  acSide: "left",
  machineWall: "left",
  tableSlot: "farTop",
  chairsSlot: "farTop",
  acSlot: "farBottom",
  counterSide: "right",
  counterSlot: "farBottom",
  acOverrideBTU: null,
};

describe("FloorPlan", () => {
  it("renderiza um svg com uma caixa por máquina posicionada", () => {
    const { layout } = computeLayout(state, catalog);
    render(<FloorPlan layout={layout!} />);
    const svg = screen.getByRole("img", { name: /planta baixa/i });
    expect(svg.querySelectorAll("rect").length).toBeGreaterThanOrEqual(layout!.machines.length);
  });

  it("mostra as cotas de fachada, comprimento e área no topo da planta", () => {
    const { layout } = computeLayout(state, catalog);
    render(<FloorPlan layout={layout!} />);
    expect(
      screen.getByText("FACHADA: 5.00m | COMPRIMENTO: 4.20m | ÁREA TOTAL: 21.0m²")
    ).toBeInTheDocument();
  });

  it("numera as máquinas como T1, T2...", () => {
    const { layout } = computeLayout(state, catalog);
    render(<FloorPlan layout={layout!} />);
    expect(screen.getByText("T1")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
  });

  it("rotula a área técnica de manutenção", () => {
    const { layout } = computeLayout(state, catalog);
    render(<FloorPlan layout={layout!} />);
    expect(screen.getByText(/ÁREA TÉCNICA MANUTENÇÃO \(1,05m\)/)).toBeInTheDocument();
  });

  it("desenha o arco de abertura da porta frontal quando doorEnabled=true", () => {
    const { layout } = computeLayout(state, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelector('path[data-door="front"]')).not.toBeNull();
  });

  it("não desenha arco de porta quando doorEnabled=false", () => {
    const { layout } = computeLayout({ ...state, doorEnabled: false }, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelector('path[data-door="front"]')).toBeNull();
  });

  it("desenha a porta técnica de 70cm com arco de abertura no drywall", () => {
    const { layout } = computeLayout(state, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelector('path[data-door="tech"]')).not.toBeNull();
    expect(screen.getByText("PORTA TÉC. 0,70m")).toBeInTheDocument();
  });

  it("desenha uma cadeira (contorno) por poof ao redor da mesa", () => {
    const { layout } = computeLayout(state, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelectorAll("[data-pouf]")).toHaveLength(3);
  });
});

describe("FloorPlan — orientation=side (fileira na parede lateral)", () => {
  const sideState: ProjectState = { ...state, orientation: "side" };

  it("renderiza sem quebrar, com uma caixa por máquina", () => {
    const { layout } = computeLayout(sideState, catalog);
    render(<FloorPlan layout={layout!} />);
    const svg = screen.getByRole("img", { name: /planta baixa/i });
    expect(svg.querySelectorAll("rect").length).toBeGreaterThanOrEqual(layout!.machines.length);
  });

  it("desenha a linha do drywall como VERTICAL (x1===x2), não mais horizontal", () => {
    const { layout } = computeLayout(sideState, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    const lines = Array.from(container.querySelectorAll("line[data-drywall]"));
    // são sempre 2 segmentos (um de cada lado do vão do corredor técnico);
    // um deles pode ter comprimento zero quando o corredor encosta bem na
    // quina (mesmo comportamento já esperado no modo "back", só que agora
    // no eixo Y em vez de X) — o que importa é que pelo menos um é real.
    expect(lines.length).toBe(2);
    for (const line of lines) {
      expect(line.getAttribute("x1")).toBe(line.getAttribute("x2"));
    }
    const hasRealSegment = lines.some(
      (l) => l.getAttribute("y1") !== l.getAttribute("y2")
    );
    expect(hasRealSegment).toBe(true);
  });

  it("continua desenhando os dois arcos de porta (técnica e frontal)", () => {
    const { layout } = computeLayout(sideState, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelector('path[data-door="tech"]')).not.toBeNull();
    expect(container.querySelector('path[data-door="front"]')).not.toBeNull();
  });

  it("a porta frontal continua na fachada (parede de baixo, linha horizontal)", () => {
    const { layout } = computeLayout(sideState, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    const frontLine = container.querySelector('path[data-door="front"]')!
      .previousElementSibling as SVGLineElement;
    expect(frontLine.tagName).toBe("line");
    expect(frontLine.getAttribute("y1")).toBe(frontLine.getAttribute("y2"));
  });

  it("rotula a área técnica com 1,05m nos dois lados de acesso técnico e paredes", () => {
    for (const techAccessSide of ["left", "right"] as const)
      for (const machineWall of ["left", "right"] as const) {
        const { layout } = computeLayout(
          { ...sideState, roomDepthMm: 6000, techAccessSide, machineWall },
          catalog
        );
        const { unmount } = render(<FloorPlan layout={layout!} />);
        expect(screen.getByText(/ÁREA TÉCNICA MANUTENÇÃO \(1,05m\)/)).toBeInTheDocument();
        unmount();
      }
  });
});

describe("FloorPlan — balcão premium", () => {
  const draw = (patch: Partial<ProjectState>) => {
    const layout = computeLayout({ ...state, ...patch }, catalog).layout!;
    return render(<FloorPlan layout={layout} />);
  };

  it("desenha o balcão em lojas de 30 m² ou mais", () => {
    const { container } = draw({ roomDepthMm: 6000 });
    expect(container.querySelector("[data-counter]")).not.toBeNull();
    expect(screen.getByText("BALCÃO")).toBeInTheDocument();
  });

  it("não desenha abaixo de 30 m²", () => {
    const { container } = draw({});
    expect(container.querySelector("[data-counter]")).toBeNull();
  });
});

describe("FloorPlan — exaustão", () => {
  it("desenha o duto de exaustão com diâmetro e comprimento", () => {
    const layout = computeLayout(state, catalog).layout!;
    const { container } = render(<FloorPlan layout={layout} />);
    expect(container.querySelector("[data-exhaust]")).not.toBeNull();
    expect(screen.getByText(/EXAUSTÃO Ø\d+ · [\d,]+m \(máx 9,10m\)/)).toBeInTheDocument();
  });
});

describe("FloorPlan — hidráulica e esgoto", () => {
  it("desenha água, bomba e canal de resíduos na área técnica", () => {
    const layout = computeLayout(state, catalog).layout!;
    const { container } = render(<FloorPlan layout={layout} sheet="hidraulica" />);
    expect(container.querySelector("[data-hydraulics]")).not.toBeNull();
    expect(screen.getAllByText("BOMBA").length).toBeGreaterThan(0);
  });
});

describe("FloorPlan — elétrica", () => {
  it("desenha a eletrocalha, os perfilados e as tomadas 127 V entre as cadeiras", () => {
    const layout = computeLayout(state, catalog).layout!;
    const { container } = render(<FloorPlan layout={layout} sheet="eletrica" />);
    expect(container.querySelector("[data-electrical]")).not.toBeNull();
    expect(container.querySelectorAll("[data-outlet-127]")).toHaveLength(2); // 2 vãos entre 3 cadeiras
  });
});

describe("FloorPlan — padrão das pranchas de projeto", () => {
  it("nome do ambiente com área, VISTA 01, cotas e título da prancha", () => {
    const layout = computeLayout(state, catalog).layout!;
    const { container } = render(<FloorPlan layout={layout} />);
    expect(screen.getByText("ATENDIMENTO")).toBeInTheDocument();
    expect(screen.getByText(`${layout.salonAreaM2.toFixed(2).replace(".", ",")} m²`)).toBeInTheDocument();
    expect(screen.getByText("VISTA 01")).toBeInTheDocument();
    expect(screen.getByText("PLANTA BAIXA: LAYOUT")).toBeInTheDocument();
    // corrente das máquinas (2 máquinas) + comprimento e fachada
    expect(container.querySelectorAll("[data-dimension]").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("5,00")).toBeInTheDocument();
    expect(screen.getByText("4,20")).toBeInTheDocument();
  });
});

describe("FloorPlan — pranchas separadas", () => {
  const layout = () => computeLayout(state, catalog).layout!;

  it("layout: arquitetura, mobiliário e exaustão, sem água/esgoto/elétrica", () => {
    const { container } = render(<FloorPlan layout={layout()} sheet="layout" />);
    expect(container.querySelector("[data-exhaust]")).not.toBeNull();
    expect(container.querySelector("[data-hydraulics]")).toBeNull();
    expect(container.querySelector("[data-electrical]")).toBeNull();
    expect(screen.getByText("PLANTA BAIXA: LAYOUT")).toBeInTheDocument();
  });

  it("água e esgoto na mesma prancha, tudo conectado até a máquina", () => {
    const l = layout();
    const { container } = render(<FloorPlan layout={l} sheet="hidraulica" />);
    expect(container.querySelector("[data-water]")).not.toBeNull();
    expect(container.querySelector("[data-sewer]")).not.toBeNull();
    expect(container.querySelector("[data-floor-drain]")).not.toBeNull();
    expect(container.querySelector("[data-exhaust]")).toBeNull();
    expect(container.querySelector("[data-electrical]")).toBeNull();
    // um ponto de água (registro + T) e um tubo de dreno por lavadora
    const washers = l.hydraulics!.washers.length;
    expect(container.querySelectorAll("[data-water-point]")).toHaveLength(washers);
    expect(container.querySelectorAll("[data-standpipe]")).toHaveLength(washers);
    expect(screen.getAllByText(/i=2%/).length).toBeGreaterThan(0);
    expect(screen.getByText("PLANTA BAIXA: TÉRREO (ÁGUA E ESGOTO)")).toBeInTheDocument();
  });

  it("traz a VISTA 01 da parede de trás: água subindo com registro e tubos de dreno", () => {
    const l = layout();
    const { container } = render(<FloorPlan layout={l} sheet="hidraulica" />);
    const washers = l.hydraulics!.washers.length;
    expect(container.querySelector("[data-elevation]")).not.toBeNull();
    expect(container.querySelectorAll("[data-elevation-riser]")).toHaveLength(washers);
    expect(container.querySelectorAll("[data-elevation-standpipe]")).toHaveLength(washers);
    expect(screen.getByText("ÁGUA FRIA E ESGOTO")).toBeInTheDocument();
    // altura do T (galões) e da boca do tubo de dreno (70 cm)
    expect(screen.getAllByText(/^0,3[45]$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("0,70").length).toBeGreaterThan(0);
  });

  it("layout e elétrica não trazem a vista", () => {
    for (const sheet of ["layout", "eletrica"] as const) {
      const { container, unmount } = render(<FloorPlan layout={layout()} sheet={sheet} />);
      expect(container.querySelector("[data-elevation]")).toBeNull();
      unmount();
    }
  });

  it("elétrica: eletrocalha e tomadas, sem hidráulica", () => {
    const { container } = render(<FloorPlan layout={layout()} sheet="eletrica" />);
    expect(container.querySelector("[data-electrical]")).not.toBeNull();
    expect(container.querySelector("[data-hydraulics]")).toBeNull();
    expect(screen.getByText("PLANTA BAIXA: ELÉTRICA")).toBeInTheDocument();
  });
});
