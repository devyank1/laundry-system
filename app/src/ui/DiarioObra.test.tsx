import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiarioObra } from "./DiarioObra";
import { useObraStore } from "../obra/obraStore";

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

  it("desfazer só na última concluída", async () => {
    render(<DiarioObra />);
    expect(screen.queryByRole("button", { name: "Desfazer" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
    await userEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
    const undo = screen.getAllByRole("button", { name: "Desfazer" });
    expect(undo).toHaveLength(1);
    expect(screen.getByText("Escolha do ponto").closest("li")).toContainElement(undo[0]);
    await userEvent.click(undo[0]);
    expect(screen.getByText("Escolha do ponto").closest("li")).toHaveAttribute("data-state", "current");
  });

  it("tudo concluído mostra a obra finalizada", () => {
    for (let i = 0; i < 25; i++) useObraStore.getState().complete();
    render(<DiarioObra />);
    expect(screen.getByText("25 de 25 etapas concluídas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluir etapa" })).not.toBeInTheDocument();
    expect(screen.getByText("Obra concluída!")).toBeInTheDocument();
  });

  it("mostra objetivo e prazo", () => {
    render(<DiarioObra />);
    expect(screen.getByText("Abrir CNPJ")).toBeInTheDocument();
    expect(screen.getByText("Até 10 dias")).toBeInTheDocument();
  });
});
