import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsightsCalculator } from "./InsightsCalculator";
import { useInsightsStore } from "./insightsStore";
import { defaultInsightsInputs } from "./model";

beforeEach(() => {
  localStorage.clear();
  useInsightsStore.setState(defaultInsightsInputs());
});

const flat = (el: HTMLElement) => (el.textContent ?? "").replace(/ /g, " ");

describe("InsightsCalculator", () => {
  it("mostra, com os valores iniciais, os números da página de referência", () => {
    render(<InsightsCalculator />);
    const v = flat(screen.getByTestId("verdict"));
    expect(v).toMatch(/15 meses/);
    expect(v).toMatch(/Recupera R\$ 6\.362/);
    expect(screen.getByText("Faturamento anual (ref.)").parentElement?.textContent).toMatch(/473\.040/);
    expect(flat(screen.getByText("Economia anual").parentElement as HTMLElement)).toMatch(/5\.303/);
  });

  it("recalcula ao digitar e persiste", async () => {
    const user = userEvent.setup();
    render(<InsightsCalculator />);
    const visita = screen.getByLabelText("Custo por visita técnica (R$)");
    await user.clear(visita);
    await user.type(visita, "1000");
    expect(flat(screen.getByTestId("verdict"))).not.toMatch(/15 meses/);
    expect(JSON.parse(localStorage.getItem("lavanderia.insights.v1") ?? "{}").visitcost).toBe("1000");
  });

  it("sem bocas pede para preencher a frota, sem NaN", async () => {
    const user = userEvent.setup();
    render(<InsightsCalculator />);
    for (const l of ["Pequena (≤12 kg)", "Média (13–18 kg)"]) {
      const f = screen.getByLabelText(`Nº de bocas — ${l}`);
      await user.clear(f);
      await user.type(f, "0");
    }
    expect(flat(screen.getByTestId("verdict"))).toMatch(/Preencha a frota/);
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it("restaurar volta aos padrões", async () => {
    const user = userEvent.setup();
    window.confirm = () => true;
    render(<InsightsCalculator />);
    const c = screen.getByLabelText("Ciclos/dia por boca");
    await user.clear(c);
    await user.type(c, "20");
    await user.click(screen.getByRole("button", { name: "Restaurar padrões" }));
    expect(flat(screen.getByTestId("verdict"))).toMatch(/15 meses/);
  });
});
