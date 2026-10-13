import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlPanel } from "./ControlPanel";
import { useProjectStore } from "../state/projectStore";

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({
    roomWidthMm: 4000,
    roomDepthMm: 3500,
    ceilingHeightMm: 2700,
    machines: [{ catalogId: "sq-stack", qty: 3 }],
    doorEnabled: true,
    techAccessSide: "right",
    furnitureEnabled: true,
    acOverrideBTU: null,
  });
});

describe("ControlPanel", () => {
  it("mostra a largura atual em metros", () => {
    render(<ControlPanel />);
    expect(screen.getByLabelText(/largura/i)).toHaveValue(4);
  });

  it("atualiza a largura no store ao digitar", async () => {
    render(<ControlPanel />);
    const input = screen.getByLabelText(/largura/i);
    await userEvent.clear(input);
    await userEvent.type(input, "6");
    expect(useProjectStore.getState().roomWidthMm).toBe(6000);
  });

  it("mostra a área total calculada a partir de largura x comprimento", () => {
    render(<ControlPanel />);
    expect(screen.getByLabelText(/área total/i)).toHaveValue(14);
  });

  it("recalcula o comprimento ao digitar a área, mantendo a largura", async () => {
    useProjectStore.setState({ roomWidthMm: 5000 });
    render(<ControlPanel />);
    const input = screen.getByLabelText(/área total/i);
    await userEvent.clear(input);
    await userEvent.type(input, "45");
    expect(useProjectStore.getState().roomWidthMm).toBe(5000);
    expect(useProjectStore.getState().roomDepthMm).toBe(9000);
    expect(screen.getByLabelText(/comprimento/i)).toHaveValue(9);
  });

  it("recalcula a área ao mudar o comprimento", async () => {
    render(<ControlPanel />);
    const input = screen.getByLabelText(/comprimento/i);
    await userEvent.clear(input);
    await userEvent.type(input, "5");
    expect(screen.getByLabelText(/área total/i)).toHaveValue(20);
  });

  it("alterna o lado de acesso técnico", async () => {
    render(<ControlPanel />);
    const select = screen.getByLabelText(/lado de acesso técnico/i);
    await userEvent.selectOptions(select, "left");
    expect(useProjectStore.getState().techAccessSide).toBe("left");
  });

  it("mostra a sugestão de BTU quando o mobiliário está habilitado", () => {
    useProjectStore.setState({ roomDepthMm: 4200 });
    render(<ControlPanel />);
    expect(screen.getByText(/Sugestão automática:/)).toBeInTheDocument();
  });

  it("permite sobrepor o BTU manualmente", async () => {
    render(<ControlPanel />);
    const select = screen.getByLabelText(/Ar-condicionado \(BTU/i);
    await userEvent.selectOptions(select, "36000");
    expect(useProjectStore.getState().acOverrideBTU).toBe(36000);
  });
});
