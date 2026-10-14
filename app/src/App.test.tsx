import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { useProjectStore } from "./state/projectStore";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({
    roomWidthMm: 5000,
    roomDepthMm: 4200,
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
  });
});

describe("App", () => {
  it("renderiza a planta 2D por padrão sem violações para um estado válido", () => {
    render(<App />);
    expect(screen.getByRole("img", { name: /planta baixa/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra o painel de violações quando o estado é inválido", () => {
    useProjectStore.setState({ roomWidthMm: 500 });
    render(<App />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("troca para a aba 3D ao clicar em Planta 3D", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<App />);
    await userEvent.setup().click(screen.getByRole("button", { name: /planta 3d/i }));
    expect(screen.getByRole("button", { name: /baixar imagem 3d/i })).toBeInTheDocument();
  });
});
