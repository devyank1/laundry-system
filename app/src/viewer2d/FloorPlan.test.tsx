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
  acOverrideBTU: null,
};

describe("FloorPlan", () => {
  it("renderiza um svg com uma caixa por máquina posicionada", () => {
    const { layout } = computeLayout(state, catalog);
    render(<FloorPlan layout={layout!} />);
    const svg = screen.getByRole("img", { name: /planta baixa/i });
    expect(svg.querySelectorAll("rect").length).toBeGreaterThanOrEqual(layout!.machines.length);
  });

  it("mostra a área em metros no rodapé da planta", () => {
    const { layout } = computeLayout(state, catalog);
    render(<FloorPlan layout={layout!} />);
    expect(screen.getByText(/5\.00m x 4\.20m/)).toBeInTheDocument();
  });

  it("desenha o arco de abertura da porta frontal quando doorEnabled=true", () => {
    const { layout } = computeLayout(state, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelector("path")).not.toBeNull();
  });

  it("não desenha arco de porta quando doorEnabled=false", () => {
    const { layout } = computeLayout({ ...state, doorEnabled: false }, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelector("path")).toBeNull();
  });
});
