import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetFakeCatalog } from "../test/fakeSupabase";

vi.mock("../lib/supabaseClient", async () => (await import("../test/fakeSupabase")).fakeSupabaseModule());
const fn = vi.hoisted(() => ({ invokeEdgeFunction: vi.fn() }));
vi.mock("../lib/edgeFunctions", () => fn);

vi.mock("./AdminTeamsPanel", () => ({ AdminTeamsPanel: () => null }));
vi.mock("./AdminAdminsPanel", () => ({ AdminAdminsPanel: () => null }));

import { AdminPanel } from "./AdminPanel";
import { refreshCatalog } from "../catalog/store";
import { CATALOG_SEED } from "../catalog/seed";

beforeEach(async () => {
  fn.invokeEdgeFunction.mockReset();
  resetFakeCatalog();
  await refreshCatalog();
});

async function fillForm() {
  await userEvent.type(screen.getByLabelText(/nome da empresa/i), "Lavanderias Sul");
  await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(CATALOG_SEED[0].model) }));
  await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(CATALOG_SEED[2].model) }));
  await userEvent.type(screen.getByLabelText(/email do dono/i), "dono@sul.com");
}

describe("AdminPanel", () => {
  it("envia nome, máquinas marcadas e email do dono pra admin-create-company", async () => {
    fn.invokeEdgeFunction.mockResolvedValue({ companyId: "c1" });
    render(<AdminPanel />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /cadastrar empresa/i }));
    expect(fn.invokeEdgeFunction).toHaveBeenCalledWith("admin-create-company", {
      name: "Lavanderias Sul",
      machineIds: [CATALOG_SEED[0].id, CATALOG_SEED[2].id].sort(),
      ownerEmail: "dono@sul.com",
    });
  });

  it("mostra mensagem de sucesso com o nome da empresa depois de criar e limpa o formulário", async () => {
    fn.invokeEdgeFunction.mockResolvedValue({ companyId: "c1" });
    render(<AdminPanel />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /cadastrar empresa/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Lavanderias Sul/);
    expect(screen.getByLabelText(/nome da empresa/i)).toHaveValue("");
  });

  it("mostra erro amigável quando invokeEdgeFunction rejeita", async () => {
    fn.invokeEdgeFunction.mockRejectedValue(new Error("Não foi possível concluir a operação. Tente novamente."));
    render(<AdminPanel />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /cadastrar empresa/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível/i);
  });

  it("exige ao menos uma máquina antes de enviar", async () => {
    render(<AdminPanel />);
    await userEvent.type(screen.getByLabelText(/nome da empresa/i), "X");
    await userEvent.type(screen.getByLabelText(/email do dono/i), "dono@x.com");
    await userEvent.click(screen.getByRole("button", { name: /cadastrar empresa/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/pelo menos uma máquina/i);
    expect(fn.invokeEdgeFunction).not.toHaveBeenCalled();
  });
});
