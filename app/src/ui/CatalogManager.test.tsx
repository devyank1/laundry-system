import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeCalls, resetFakeCatalog } from "../test/fakeSupabase";

vi.mock("../lib/supabaseClient", async () => (await import("../test/fakeSupabase")).fakeSupabaseModule());

import { CatalogManager } from "./CatalogManager";
import { refreshCatalog } from "../catalog/store";

beforeEach(async () => {
  resetFakeCatalog();
  await refreshCatalog();
});

describe("CatalogManager", () => {
  it("lista as máquinas do catálogo seed", () => {
    render(<CatalogManager onClose={() => {}} />);
    expect(screen.getByText(/Speed Queen Stack 10/)).toBeInTheDocument();
    expect(screen.getByText(/Speed Queen Stack Elétrica \(SSU\/SSG\)/)).toBeInTheDocument();
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

    expect(await screen.findByText(/Teste Modelo X/)).toBeInTheDocument();
  });

  it("remove uma máquina ao clicar em remover", async () => {
    render(<CatalogManager onClose={() => {}} />);
    const items = screen.getAllByRole("listitem");
    const firstRemoveButton = items[0].querySelector("button");
    await userEvent.click(firstRemoveButton!);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(items.length - 1));
  });

  it("chama onClose ao clicar em Fechar", async () => {
    const onClose = vi.fn();
    render(<CatalogManager onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("mostra erro ao tentar adicionar máquina com ID duplicado", async () => {
    render(<CatalogManager onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("ID"), "sq-stack");
    await userEvent.type(screen.getByLabelText("Marca"), "Teste");
    await userEvent.type(screen.getByLabelText("Modelo"), "Teste");
    await userEvent.type(screen.getByLabelText(/largura/i), "700");
    await userEvent.type(screen.getByLabelText(/profundidade/i), "800");
    await userEvent.type(screen.getByLabelText(/altura/i), "2000");
    await userEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/já existe/i);
  });

  it("mostra erro amigável (sem detalhe do banco) quando a gravação é recusada", async () => {
    fakeCalls.failWrites = true;
    render(<CatalogManager onClose={() => {}} />);
    const firstRemoveButton = screen.getAllByRole("listitem")[0].querySelector("button");
    await userEvent.click(firstRemoveButton!);
    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível salvar/i);
    expect(screen.queryByText(/row-level security|permission denied/i)).not.toBeInTheDocument();
  });

  it("não oferece mais 'Restaurar padrão' (apagaria o catálogo de produção)", () => {
    render(<CatalogManager onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /restaurar padrão/i })).not.toBeInTheDocument();
  });
});
