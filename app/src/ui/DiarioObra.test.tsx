import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiarioObra } from "./DiarioObra";
import { currentIndex, useObraStore } from "../obra/obraStore";
import { OBRA_STEPS } from "../obra/steps";

const st = () => useObraStore.getState();
const stepLi = (title: string) => screen.getByText(title).closest("ol > li") as HTMLElement;

function goTo(id: string) {
  while (OBRA_STEPS[currentIndex(st().doneAt)]?.id !== id) {
    const step = OBRA_STEPS[currentIndex(st().doneAt)];
    for (const c of step.checklist ?? []) if (!st().checked.includes(c.id)) st().toggle(c.id);
    st().complete();
  }
}

beforeEach(() => {
  localStorage.clear();
  st().reset();
});

describe("DiarioObra", () => {
  it("começa na etapa 0, com o botão só na etapa atual", () => {
    render(<DiarioObra />);
    expect(screen.getByText("0 de 28 etapas concluídas")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Concluir etapa" })).toHaveLength(1);
    expect(stepLi("Prazos")).toHaveAttribute("data-state", "current");
    expect(stepLi("Inauguração")).toHaveAttribute("data-state", "todo");
  });

  it("concluir marca com a data e passa pra próxima", async () => {
    render(<DiarioObra />);
    await userEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
    expect(stepLi("Prazos")).toHaveAttribute("data-state", "done");
    expect(within(stepLi("Prazos")).getByText(/^Concluída em \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    expect(stepLi("Escolha do ponto")).toHaveAttribute("data-state", "current");
    expect(screen.getByText("1 de 28 etapas concluídas")).toBeInTheDocument();
  });

  it("checklist obrigatório libera o Concluir quando tudo marcado", async () => {
    goTo("ponto");
    render(<DiarioObra />);
    const step = stepLi("Escolha do ponto");
    const boxes = within(step).getAllByRole("checkbox");
    expect(boxes).toHaveLength(8);
    const btn = within(step).getByRole("button", { name: "Concluir etapa" });
    expect(btn).toBeDisabled();
    for (const b of boxes) await userEvent.click(b);
    expect(within(step).getByText("8 de 8")).toBeInTheDocument();
    await userEvent.click(btn);
    expect(step).toHaveAttribute("data-state", "done");
  });

  it("checklist de etapa futura fica travado", () => {
    render(<DiarioObra />);
    const future = stepLi("Obrigações legais");
    expect(within(future).getByText("Abrir CNPJ ou MEI")).toBeInTheDocument();
    expect(within(future).getAllByRole("checkbox").every((b) => (b as HTMLInputElement).disabled)).toBe(true);
  });

  it("inauguração: itens opcionais não travam", () => {
    goTo("inauguracao");
    render(<DiarioObra />);
    const step = stepLi("Inauguração");
    expect(within(step).getByText("0 de 8 (opcionais)")).toBeInTheDocument();
    expect(within(step).getByText("Arco de bexigas")).toBeInTheDocument();
    expect(within(step).getByRole("button", { name: "Concluir etapa" })).toBeEnabled();
  });

  it("compras: + Adicionar material extra e remover", async () => {
    goTo("compras-materiais");
    render(<DiarioObra />);
    const step = stepLi("Início das compras de materiais hidráulicos e elétricos");
    const add = within(step).getByRole("button", { name: "+ Adicionar" });
    expect(add).toBeDisabled();
    await userEvent.type(within(step).getByRole("textbox", { name: "Material extra" }), "Piso vinílico");
    await userEvent.click(add);
    expect(within(step).getByText("Piso vinílico")).toBeInTheDocument();
    expect(st().extras).toEqual([{ text: "Piso vinílico", bought: false }]);
    expect(within(step).getByText(/0 de 1 comprados/)).toBeInTheDocument();
    await userEvent.click(within(step).getByRole("checkbox", { name: "Piso vinílico" }));
    expect(st().extras[0].bought).toBe(true);
    expect(within(step).getByText(/1 de 1 comprados/)).toBeInTheDocument();
    await userEvent.click(within(step).getByRole("button", { name: "Remover Piso vinílico" }));
    expect(st().extras).toEqual([]);
  });

  it("material extra pode ser marcado como comprado depois da etapa concluída", async () => {
    goTo("compras-materiais");
    st().addExtra("Rodapé");
    st().complete();
    render(<DiarioObra />);
    const step = stepLi("Início das compras de materiais hidráulicos e elétricos");
    expect(step).toHaveAttribute("data-state", "done");
    await userEvent.click(within(step).getByRole("checkbox", { name: "Rodapé" }));
    expect(st().extras[0].bought).toBe(true);
  });

  it("desfazer só na última concluída", async () => {
    render(<DiarioObra />);
    expect(screen.queryByRole("button", { name: "Desfazer" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
    const undo = screen.getAllByRole("button", { name: "Desfazer" });
    expect(undo).toHaveLength(1);
    expect(stepLi("Prazos")).toContainElement(undo[0]);
    await userEvent.click(undo[0]);
    expect(stepLi("Prazos")).toHaveAttribute("data-state", "current");
  });

  it("tudo concluído mostra a obra finalizada", () => {
    goTo("inauguracao");
    st().complete();
    render(<DiarioObra />);
    expect(screen.getByText("28 de 28 etapas concluídas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluir etapa" })).not.toBeInTheDocument();
    expect(screen.getByText("Obra concluída!")).toBeInTheDocument();
  });

  it("mostra objetivo e prazo", () => {
    render(<DiarioObra />);
    expect(screen.getByText(/contador alinha/)).toBeInTheDocument();
    expect(screen.getByText("Até 10 dias")).toBeInTheDocument();
  });
});
