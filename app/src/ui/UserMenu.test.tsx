import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../profile/photos", () => ({ photoUrl: vi.fn(async () => null) }));

import { UserMenu } from "./UserArea";

async function open(props: Partial<Parameters<typeof UserMenu>[0]> = {}) {
  const onSignOut = vi.fn();
  const onProjects = vi.fn();
  render(<UserMenu name="Ana Souza" subtitle="Vendedora" photoPath={null} onSignOut={onSignOut} onProjects={onProjects} {...props} />);
  await userEvent.click(screen.getByRole("button", { name: /ana souza/i }));
  return { onSignOut, onProjects };
}

describe("UserMenu (menu do nome)", () => {
  it("mostra o nome e o cargo da conta, com iniciais sem foto", () => {
    render(<UserMenu name="Ana Souza" subtitle="Vendedora" photoPath={null} onSignOut={() => {}} />);
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Vendedora")).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("Meus projetos chama onProjects e fecha o menu", async () => {
    const { onProjects } = await open();
    await userEvent.click(screen.getByRole("menuitem", { name: /meus projetos/i }));
    expect(onProjects).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("sem onProjects não mostra Meus projetos", async () => {
    await open({ onProjects: undefined });
    expect(screen.queryByRole("menuitem", { name: /meus projetos/i })).not.toBeInTheDocument();
  });

  it("Meus orçamentos aparece como em breve (desabilitado)", async () => {
    await open();
    expect(screen.getByRole("menuitem", { name: /meus orçamentos/i })).toBeDisabled();
  });

  it("Sair fica no menu e chama onSignOut", async () => {
    const { onSignOut } = await open();
    await userEvent.click(screen.getByRole("menuitem", { name: /^sair$/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it("não tem mais campo de nome nem Entrar na conta", async () => {
    await open();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/entrar na conta/i)).not.toBeInTheDocument();
  });
});
