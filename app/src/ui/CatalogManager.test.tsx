import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogManager } from "./CatalogManager";

beforeEach(() => {
  localStorage.clear();
});

describe("CatalogManager", () => {
  it("lista as máquinas do catálogo seed", () => {
    render(<CatalogManager onClose={() => {}} />);
    expect(screen.getByText(/Speed Queen Stack/)).toBeInTheDocument();
    expect(screen.getByText(/Mamute Smart 10/)).toBeInTheDocument();
    expect(screen.getByText(/Mamute Smart 17/)).toBeInTheDocument();
  });

  it("adiciona uma máquina nova preenchida no formulário", async () => {
    render(<CatalogManager onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("ID"), "custom-1");
    await userEvent.type(screen.getByLabelText("Marca"), "Teste");
    await userEvent.type(screen.getByLabelText("Modelo"), "Modelo X");
    await userEvent.type(screen.getByLabelText(/largura/i), "700");
    await userEvent.type(screen.getByLabelText(/profundidade/i), "800");
    await userEvent.type(screen.getByLabelText(/altura/i), "2000");
    await userEvent.click(screen.getByRole("button", { name: /adicionar/i }));

    expect(screen.getByText(/Teste Modelo X/)).toBeInTheDocument();
  });

  it("remove uma máquina ao clicar em remover", async () => {
    render(<CatalogManager onClose={() => {}} />);
    const items = screen.getAllByRole("listitem");
    const firstRemoveButton = items[0].querySelector("button");
    await userEvent.click(firstRemoveButton!);
    expect(screen.getAllByRole("listitem")).toHaveLength(items.length - 1);
  });

  it("chama onClose ao clicar em Fechar", async () => {
    const onClose = vi.fn();
    render(<CatalogManager onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
