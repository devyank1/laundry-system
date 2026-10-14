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

  it("desenha um círculo por poof ao redor da mesa", () => {
    const { layout } = computeLayout(state, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelectorAll("circle[data-pouf]")).toHaveLength(3);
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
    const lines = Array.from(container.querySelectorAll("line")).filter(
      (l) => l.getAttribute("stroke-width") === "4"
    );
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

  it("a porta frontal fica na parede oposta à fileira (x constante = largura da sala)", () => {
    const { layout } = computeLayout(sideState, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    const frontLine = container.querySelector('path[data-door="front"]')!
      .previousElementSibling as SVGLineElement;
    expect(frontLine.tagName).toBe("line");
    expect(frontLine.getAttribute("x1")).toBe(frontLine.getAttribute("x2"));
  });
});
