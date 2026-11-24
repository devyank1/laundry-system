import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fn = vi.hoisted(() => ({ invokeEdgeFunction: vi.fn() }));
vi.mock("../lib/edgeFunctions", () => fn);
const admins = vi.hoisted(() => ({ listAdmins: vi.fn() }));
vi.mock("../admin/admins", () => admins);

import { AdminAdminsPanel } from "./AdminAdminsPanel";

beforeEach(() => {
  fn.invokeEdgeFunction.mockReset();
  admins.listAdmins.mockReset();
  admins.listAdmins.mockResolvedValue([{ id: "a1", email: "eu@x.com", createdAt: "2026-11-15T10:00:00Z" }]);
});

describe("AdminAdminsPanel", () => {
  it("mostra os administradores atuais", async () => {
    render(<AdminAdminsPanel />);
    expect(await screen.findByText("eu@x.com")).toBeInTheDocument();
  });

  it("convida pelo email, avisa e recarrega a lista", async () => {
    fn.invokeEdgeFunction.mockResolvedValue({ userId: "u2" });
    render(<AdminAdminsPanel />);
    await screen.findByText("eu@x.com");
    admins.listAdmins.mockResolvedValue([
      { id: "a1", email: "eu@x.com", createdAt: "2026-11-15T10:00:00Z" },
      { id: "u2", email: "novo@x.com", createdAt: "2026-11-24T10:00:00Z" },
    ]);
    await userEvent.type(screen.getByLabelText(/email do novo admin/i), "novo@x.com");
    await userEvent.click(screen.getByRole("button", { name: /convidar admin/i }));
    expect(fn.invokeEdgeFunction).toHaveBeenCalledWith("admin-invite-admin", { email: "novo@x.com" });
    expect(await screen.findByRole("status")).toHaveTextContent(/convite enviado para novo@x.com/i);
    expect(await screen.findByText("novo@x.com")).toBeInTheDocument();
  });

  it("mostra o erro da função", async () => {
    fn.invokeEdgeFunction.mockRejectedValue(new Error("Este email já tem cadastro no configurador."));
    render(<AdminAdminsPanel />);
    await userEvent.type(screen.getByLabelText(/email do novo admin/i), "x@x.com");
    await userEvent.click(screen.getByRole("button", { name: /convidar admin/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/já tem cadastro/i);
  });

  it("campo vazio avisa sem chamar a função", async () => {
    render(<AdminAdminsPanel />);
    await userEvent.click(screen.getByRole("button", { name: /convidar admin/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(fn.invokeEdgeFunction).not.toHaveBeenCalled();
  });
});
