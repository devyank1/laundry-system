import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FacadeControls } from "./FacadeControls";
import { normalizeHex } from "./hexColor";
import { useProjectStore } from "../state/projectStore";

beforeEach(() => {
  useProjectStore.setState({
    facadeVisible: true,
    facadeColor: "#8fa892",
    facadeSignColor: "#a8977c",
  });
});

describe("normalizeHex", () => {
  it("aceita com ou sem #, maiúsculas e o atalho de 3 dígitos", () => {
    expect(normalizeHex("#8FA892")).toBe("#8fa892");
    expect(normalizeHex("8fa892")).toBe("#8fa892");
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex(" 123456 ")).toBe("#123456");
  });

  it("recusa o que não é HEX", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("verde")).toBeNull();
    expect(normalizeHex("#gggggg")).toBeNull();
  });
});

describe("FacadeControls", () => {
  it("mostra e esconde a fachada", async () => {
    render(<FacadeControls />);
    await userEvent.click(screen.getByLabelText(/mostrar fachada/i));
    expect(useProjectStore.getState().facadeVisible).toBe(false);
    expect(screen.queryByLabelText(/cor da fachada \(HEX\)/i)).toBeNull();
    await userEvent.click(screen.getByLabelText(/mostrar fachada/i));
    expect(useProjectStore.getState().facadeVisible).toBe(true);
  });

  it("muda a cor ao digitar um HEX válido depois do #", async () => {
    render(<FacadeControls />);
    const input = screen.getByLabelText(/cor da fachada \(HEX\)/i);
    expect(input).toHaveValue("8fa892");
    await userEvent.clear(input);
    await userEvent.type(input, "1E3A8A");
    expect(useProjectStore.getState().facadeColor).toBe("#1e3a8a");
  });

  it("HEX incompleto não muda a cor e volta ao sair do campo", async () => {
    render(<FacadeControls />);
    const input = screen.getByLabelText(/cor do painel do letreiro \(HEX\)/i);
    await userEvent.clear(input);
    await userEvent.type(input, "12");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(useProjectStore.getState().facadeSignColor).toBe("#a8977c");
    fireEvent.blur(input);
    expect(input).toHaveValue("a8977c");
  });

  it("mostra e esconde o teto visto de fora", async () => {
    useProjectStore.setState({ roofVisible: true });
    render(<FacadeControls />);
    await userEvent.click(screen.getByLabelText(/mostrar teto por fora/i));
    expect(useProjectStore.getState().roofVisible).toBe(false);
  });

  it("sem fachada o teto sai junto: opção do teto some, preferência fica guardada", async () => {
    useProjectStore.setState({ facadeVisible: true, roofVisible: true });
    render(<FacadeControls />);
    await userEvent.click(screen.getByLabelText(/mostrar fachada/i));
    expect(screen.queryByLabelText(/mostrar teto por fora/i)).not.toBeInTheDocument();
    expect(useProjectStore.getState().roofVisible).toBe(true);
    await userEvent.click(screen.getByLabelText(/mostrar fachada/i));
    expect(screen.getByLabelText(/mostrar teto por fora/i)).toBeChecked();
  });

  it("alterna a iluminação entre dia e noite", async () => {
    useProjectStore.setState({ sceneLighting: "day" });
    render(<FacadeControls />);
    await userEvent.selectOptions(screen.getByLabelText(/iluminação/i), "night");
    expect(useProjectStore.getState().sceneLighting).toBe("night");
  });

  it("o seletor de cor também muda a cor", () => {
    render(<FacadeControls />);
    fireEvent.change(screen.getByLabelText(/cor da fachada \(seletor\)/i), {
      target: { value: "#ff0000" },
    });
    expect(useProjectStore.getState().facadeColor).toBe("#ff0000");
  });
});
