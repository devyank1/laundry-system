import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiarioObra } from "./DiarioObra";
import { useObraStore } from "../obra/obraStore";
import { OBRA_STEPS } from "../obra/steps";

beforeEach(() => {
  localStorage.clear();
  useObraStore.getState().reset();
});

describe("DiarioObra", () => {
  it("começa na etapa 0, com o botão só na etapa atual", () => {
    render(<DiarioObra />);
    expect(screen.getByText("0 de 25 etapas concluídas")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Concluir etapa" })).toHaveLength(1);
    const current = screen.getByText("Prazos").closest("li")!;
    expect(current).toHaveAttribute("data-state", "current");
    expect(within(current).getByRole("button", { name: "Concluir etapa" })).toBeInTheDocument();
    expect(screen.getByText("Inauguração").closest("li")).toHaveAttribute("data-state", "todo");
  });

  it("concluir marca com a data e passa pra próxima", async () => {
    render(<DiarioObra />);
    await userEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
    const done = screen.getByText("Prazos").closest("li")!;
    expect(done).toHaveAttribute("data-state", "done");
    expect(within(done).getByText(/^Concluída em \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    expect(screen.getByText("Escolha do ponto").closest("li")).toHaveAttribute("data-state", "current");
    expect(screen.getByText("1 de 25 etapas concluídas")).toBeInTheDocument();
  });

  it("checklist da etapa atual libera o Concluir quando tudo marcado", async () => {
    render(<DiarioObra />);
    await userEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
    const step = screen.getByText("Escolha do ponto").closest("li")!;
    const boxes = within(step).getAllByRole("checkbox");
    expect(boxes).toHaveLength(8);
    expect(within(step).getByText("0 de 8")).toBeInTheDocument();
    const btn = within(step).getByRole("button", { name: "Concluir etapa" });
    expect(btn).toBeDisabled();
    for (const b of boxes) await userEvent.click(b);
    expect(within(step).getByText("8 de 8")).toBeInTheDocument();
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(step).toHaveAttribute("data-state", "done");
    expect(within(step).getAllByRole("checkbox").every((b) => (b as HTMLInputElement).disabled && (b as HTMLInputElement).checked)).toBe(true);
  });

  it("checklist de etapa futura não dá pra marcar", () => {
    render(<DiarioObra />);
    const future = screen.getByText("Obrigações legais").closest("li")!;
    expect(within(future).getByText("Abrir CNPJ ou MEI")).toBeInTheDocument();
    expect(within(future).getAllByRole("checkbox").every((b) => (b as HTMLInputElement).disabled)).toBe(true);
  });

  it("desfazer só na última concluída", async () => {
    render(<DiarioObra />);
    expect(screen.queryByRole("button", { name: "Desfazer" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
    const undo = screen.getAllByRole("button", { name: "Desfazer" });
    expect(undo).toHaveLength(1);
    expect(screen.getByText("Prazos").closest("li")).toContainElement(undo[0]);
    await userEvent.click(undo[0]);
    expect(screen.getByText("Prazos").closest("li")).toHaveAttribute("data-state", "current");
  });

  it("tudo concluído mostra a obra finalizada", () => {
    for (const step of OBRA_STEPS) {
      for (const c of step.checklist ?? []) useObraStore.getState().toggle(c.id);
      useObraStore.getState().complete();
    }
    render(<DiarioObra />);
    expect(screen.getByText("25 de 25 etapas concluídas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluir etapa" })).not.toBeInTheDocument();
    expect(screen.getByText("Obra concluída!")).toBeInTheDocument();
  });

  it("mostra objetivo e prazo", () => {
    render(<DiarioObra />);
    expect(screen.getByText(/contador alinha/)).toBeInTheDocument();
    expect(screen.getByText("Até 10 dias")).toBeInTheDocument();
  });
});
