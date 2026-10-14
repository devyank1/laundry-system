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
  ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 2 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  furnitureSide: "left",
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
    expect(container.querySelectorAll("circle[data-pouf]")).toHaveLength(2);
  });
});
