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
    totemSide: "left",
    tableSide: "left",
    chairsSide: "left",
    acSide: "left",
    acOverrideBTU: null,
    orientation: "back",
  });
});

describe("ControlPanel", () => {
  it("mostra a largura atual em metros", () => {
    render(<ControlPanel />);
    expect(screen.getByLabelText(/largura/i)).toHaveValue(4);
  });

  it("alterna a orientação da fileira", async () => {
    render(<ControlPanel />);
    const select = screen.getByLabelText(/orientação/i);
    await userEvent.selectOptions(select, "side");
    expect(useProjectStore.getState().orientation).toBe("side");
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

  it("alterna o lado de cada item de mobiliário de forma independente", async () => {
    render(<ControlPanel />);
    await userEvent.selectOptions(screen.getByLabelText(/lado do totem/i), "right");
    await userEvent.selectOptions(screen.getByLabelText(/lado da mesa/i), "right");
    await userEvent.selectOptions(screen.getByLabelText(/lado das cadeiras/i), "left");
    await userEvent.selectOptions(screen.getByLabelText(/lado do ar-condicionado/i), "left");
    expect(useProjectStore.getState().totemSide).toBe("right");
    expect(useProjectStore.getState().tableSide).toBe("right");
    expect(useProjectStore.getState().chairsSide).toBe("left");
    expect(useProjectStore.getState().acSide).toBe("left");
  });

  it("em 'parede lateral' oferece direita cima/baixo e esquerda (perto das máquinas)", async () => {
    useProjectStore.setState({ orientation: "side", machineWall: "left" });
    render(<ControlPanel />);
    const table = screen.getByLabelText(/lado da mesa/i);
    expect(Array.from((table as HTMLSelectElement).options).map((o) => o.text)).toEqual([
      "Direita cima",
      "Direita baixo",
      "Esquerda (perto das máquinas)",
    ]);
    await userEvent.selectOptions(table, "farBottom");
    await userEvent.selectOptions(screen.getByLabelText(/lado das cadeiras/i), "near");
    await userEvent.selectOptions(screen.getByLabelText(/lado do ar-condicionado/i), "farTop");
    expect(useProjectStore.getState().tableSlot).toBe("farBottom");
    expect(useProjectStore.getState().chairsSlot).toBe("near");
    expect(useProjectStore.getState().acSlot).toBe("farTop");

    await userEvent.selectOptions(screen.getByLabelText(/parede das máquinas/i), "right");
    expect(
      Array.from((screen.getByLabelText(/lado da mesa/i) as HTMLSelectElement).options).map(
        (o) => o.text
      )
    ).toEqual(["Esquerda cima", "Esquerda baixo", "Direita (perto das máquinas)"]);
  });

  it("em 'parede lateral' o totem vai ao lado da primeira ou da última máquina", async () => {
    useProjectStore.setState({ orientation: "side", techAccessSide: "right", totemSide: "left" });
    render(<ControlPanel />);
    const select = screen.getByLabelText(/lado do totem/i) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.text)).toEqual([
      "Ao lado da primeira máquina (T1)",
      "Ao lado da última máquina (T3)",
    ]);
    await userEvent.selectOptions(select, "right");
    expect(useProjectStore.getState().totemSide).toBe("right");
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

describe("ControlPanel — lavanderia premium", () => {
  it("só mostra 'Lado do balcão' a partir de 30 m²", async () => {
    const { rerender } = render(<ControlPanel />);
    expect(screen.queryByLabelText(/lado do balcão/i)).not.toBeInTheDocument();

    useProjectStore.setState({ roomWidthMm: 5000, roomDepthMm: 6000 });
    rerender(<ControlPanel />);
    const select = screen.getByLabelText(/lado do balcão/i);
    await userEvent.selectOptions(select, "left");
    expect(useProjectStore.getState().counterSide).toBe("left");
  });
});

describe("ControlPanel — exaustão", () => {
  it("mostra o diâmetro e o comprimento do duto de exaustão", () => {
    useProjectStore.setState({ roomWidthMm: 5000, roomDepthMm: 6000, machines: [{ catalogId: "sq-stack", qty: 3 }] });
    const { container } = render(<ControlPanel />);
    const info = container.querySelector("[data-exhaust-info]");
    expect(info).not.toBeNull();
    expect(info!.textContent).toMatch(/Ø229 mm/);
    expect(info!.textContent).toMatch(/máx\. 9,1 m/);
  });
});

describe("ControlPanel — hidráulica", () => {
  it("resume o barramento de água e o canal de esgoto", () => {
    useProjectStore.setState({ roomWidthMm: 5000, roomDepthMm: 6000, machines: [{ catalogId: "sq-stack", qty: 3 }] });
    const { container } = render(<ControlPanel />);
    const info = container.querySelector("[data-hydraulics-info]");
    expect(info).not.toBeNull();
    expect(info!.textContent).toMatch(/120 L\/min/);
    expect(info!.textContent).toMatch(/200 a 570 kPa/);
    expect(info!.textContent).toMatch(/esgoto suspenso Ø114 mm/);
    expect(info!.textContent).toMatch(/6 bombas dosadoras/);
  });
});

describe("ControlPanel — elétrica", () => {
  it("resume perfilados, Steck, tomadas 220 V e 127 V", () => {
    useProjectStore.setState({ roomWidthMm: 5000, roomDepthMm: 6000, machines: [{ catalogId: "sq-stack", qty: 3 }] });
    const { container } = render(<ControlPanel />);
    const info = container.querySelector("[data-electrical-info]");
    expect(info).not.toBeNull();
    expect(info!.textContent).toMatch(/3 perfilado\(s\)/);
    expect(info!.textContent).toMatch(/3 tomada\(s\) Steck/);
    expect(info!.textContent).toMatch(/6 tomadas 220 V/);
    expect(info!.textContent).toMatch(/3 tomadas 127 V/);
  });
});
