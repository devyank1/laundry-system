import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoiCalculator } from "./RoiCalculator";
import { useRoiStore } from "./roiStore";
import { defaultRoiState } from "./model";

beforeEach(() => {
  localStorage.clear();
  useRoiStore.setState(defaultRoiState());
});

const text = (label: string) => screen.getByText(label).closest(".roi-stat") as HTMLElement;

describe("RoiCalculator", () => {
  // (conta igual à da referência conferida em model.test; aqui a lista padrão atual)
  it("mostra os números dos valores iniciais", () => {
    render(<RoiCalculator />);
    expect(text("Investimento total").textContent).toMatch(/303\.182/);
    expect(text("Margem mensal (plena)").textContent).toMatch(/24\.432/);
    expect(text("Payback (com rampa)").textContent).toMatch(/17 meses/);
    expect(text("ROI anual").textContent).toMatch(/97%/);
    expect(text("Caixa em 5 anos").textContent).toMatch(/1\.055\.735/);
  });

  it("recalcula ao digitar (aceita vírgula) e persiste", async () => {
    const user = userEvent.setup();
    render(<RoiCalculator />);
    const preco = screen.getByLabelText("Preço por cesto");
    await user.clear(preco);
    await user.type(preco, "22");
    expect(text("Margem mensal (plena)").textContent).not.toMatch(/24\.432/);
    expect(JSON.parse(localStorage.getItem("lavanderia.roi.v1") ?? "{}").op.preco).toBe(22);
    await user.clear(preco);
    await user.type(preco, "18,0");
    expect(text("Margem mensal (plena)").textContent).toMatch(/24\.432/);
  });

  it("campo vazio vira zero sem quebrar a tela", async () => {
    const user = userEvent.setup();
    render(<RoiCalculator />);
    await user.clear(screen.getByLabelText("Preço por cesto"));
    expect(text("Investimento total").textContent).toMatch(/303\.182/);
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("editar um custo fixo recalcula o total arredondado", async () => {
    const user = userEvent.setup();
    render(<RoiCalculator />);
    await user.click(screen.getByText("Detalhar custos fixos"));
    const aluguel = screen.getByLabelText("Valor — Aluguel");
    await user.clear(aluguel);
    await user.type(aluguel, "4500");
    expect((screen.getByLabelText("Custo fixo mensal (total)") as HTMLInputElement).value).toBe("9000");
  });

  it("financiado mostra entrada, parcela e juros", async () => {
    const user = userEvent.setup();
    render(<RoiCalculator />);
    await user.click(screen.getByRole("button", { name: "Financiado" }));
    const group = screen.getByText(/parcela/i, { selector: "p" });
    expect(within(group.parentElement as HTMLElement).getByText(/juros totais/)).toBeInTheDocument();
  });

  it("restaurar volta aos valores iniciais", async () => {
    const user = userEvent.setup();
    window.confirm = () => true;
    render(<RoiCalculator />);
    const preco = screen.getByLabelText("Preço por cesto");
    await user.clear(preco);
    await user.type(preco, "30");
    await user.click(screen.getByRole("button", { name: "Restaurar valores iniciais" }));
    expect(text("Margem mensal (plena)").textContent).toMatch(/24\.432/);
  });
});
