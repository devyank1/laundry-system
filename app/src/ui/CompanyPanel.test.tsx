import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthState } from "../auth/useAuth";

const auth = vi.hoisted(() => ({ state: null as unknown as AuthState }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.state }));
const fn = vi.hoisted(() => ({ invokeEdgeFunction: vi.fn() }));
vi.mock("../lib/edgeFunctions", () => fn);
const members = vi.hoisted(() => ({ listCompanyMembers: vi.fn() }));
vi.mock("../company/members", () => members);

import { CompanyPanel } from "./CompanyPanel";

const team = [
  { id: "u-dono", email: "dono@sul.com", isOwner: true, active: true },
  { id: "u-col", email: "colega@sul.com", isOwner: false, active: true },
  { id: "u-rev", email: "antigo@sul.com", isOwner: false, active: false },
];

function loginAs(isOwner: boolean) {
  auth.state = {
    profile: { id: isOwner ? "u-dono" : "u-col", role: "empresa", companyId: "c1", isOwner, active: true },
    loading: false,
    signOut: async () => {},
  };
}

beforeEach(() => {
  fn.invokeEdgeFunction.mockReset().mockResolvedValue({ ok: true });
  members.listCompanyMembers.mockReset().mockResolvedValue(team);
});

describe("CompanyPanel", () => {
  it("lista os membros da empresa com o status de cada um", async () => {
    loginAs(true);
    render(<CompanyPanel />);
    expect(await screen.findByText("colega@sul.com")).toBeInTheDocument();
    expect(members.listCompanyMembers).toHaveBeenCalledWith("c1");
    expect(screen.getByText("antigo@sul.com").closest("li")).toHaveTextContent(/revogado/i);
    expect(screen.getByText("dono@sul.com").closest("li")).toHaveTextContent(/dono/i);
  });

  it("dono vê o formulário de convite; convite chama company-invite-colleague e recarrega a lista", async () => {
    loginAs(true);
    render(<CompanyPanel />);
    await screen.findByText("colega@sul.com");
    await userEvent.type(screen.getByLabelText(/email do colega/i), "novo@sul.com");
    await userEvent.click(screen.getByRole("button", { name: /convidar/i }));
    expect(fn.invokeEdgeFunction).toHaveBeenCalledWith("company-invite-colleague", { email: "novo@sul.com" });
    expect(await screen.findByRole("status")).toHaveTextContent(/novo@sul.com/);
    expect(members.listCompanyMembers).toHaveBeenCalledTimes(2);
  });

  it("colega (não-dono) não vê formulário de convite nem botão de revogar", async () => {
    loginAs(false);
    render(<CompanyPanel />);
    await screen.findByText("colega@sul.com");
    expect(screen.queryByLabelText(/email do colega/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revogar/i })).not.toBeInTheDocument();
  });

  it("revogar chama company-revoke-member com o userId do colega; dono e revogados não têm botão", async () => {
    loginAs(true);
    render(<CompanyPanel />);
    const colega = (await screen.findByText("colega@sul.com")).closest("li")!;
    expect(within(screen.getByText("dono@sul.com").closest("li")!).queryByRole("button")).toBeNull();
    expect(within(screen.getByText("antigo@sul.com").closest("li")!).queryByRole("button")).toBeNull();
    await userEvent.click(within(colega).getByRole("button", { name: /revogar/i }));
    expect(fn.invokeEdgeFunction).toHaveBeenCalledWith("company-revoke-member", { userId: "u-col" });
  });

  it("erro da function aparece como mensagem amigável", async () => {
    loginAs(true);
    fn.invokeEdgeFunction.mockRejectedValue(new Error("Este email já tem cadastro no configurador."));
    render(<CompanyPanel />);
    await screen.findByText("colega@sul.com");
    await userEvent.type(screen.getByLabelText(/email do colega/i), "dono@sul.com");
    await userEvent.click(screen.getByRole("button", { name: /convidar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/já tem cadastro/i);
  });
});
