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
vi.mock("../profile/photos", () => ({ photoUrl: async (p: string) => `https://fotos/${p}` }));

import { CompanyPanel } from "./CompanyPanel";

const base = { email: null, cpf: null, phone: null, photoPath: null, registered: true, active: true, isOwner: false };
const ownerView = [
  { ...base, id: "u-dono", fullName: "Dono Sul", jobTitle: "Diretor", isOwner: true, email: "dono@sul.com", cpf: "52998224725", phone: "11987654321", photoPath: "u-dono/photo" },
  { ...base, id: "u-col", fullName: "Carla Colega", jobTitle: "Vendedora", email: "colega@sul.com", cpf: "11144477735", phone: "11912345678", photoPath: "u-col/photo" },
  { ...base, id: "u-rev", fullName: "Antigo Vendedor", jobTitle: "Vendedor", active: false, email: "antigo@sul.com" },
  { ...base, id: "u-novo", fullName: null, jobTitle: null, registered: false, email: "novo@sul.com" },
];
const colleagueView = ownerView.map((m) => (m.id === "u-col" ? m : { ...m, email: null, cpf: null, phone: null, photoPath: null }));

function loginAs(isOwner: boolean) {
  auth.state = {
    profile: { id: isOwner ? "u-dono" : "u-col", role: "empresa", companyId: "c1", isOwner, active: true, fullName: "Fulano", registrationComplete: true },
    loading: false,
    signOut: async () => {},
    refreshProfile: async () => {},
  };
  members.listCompanyMembers.mockResolvedValue(isOwner ? ownerView : colleagueView);
}

const row = (text: string) => screen.getByText(text).closest("li")!;

beforeEach(() => {
  fn.invokeEdgeFunction.mockReset().mockResolvedValue({ ok: true });
  members.listCompanyMembers.mockReset();
});

describe("CompanyPanel", () => {
  it("dono vê nome, cargo, CPF, telefone e foto de cada um", async () => {
    loginAs(true);
    render(<CompanyPanel />);
    await screen.findByText("Carla Colega");
    expect(members.listCompanyMembers).toHaveBeenCalledWith();
    const carla = row("Carla Colega");
    expect(carla).toHaveTextContent("Vendedora");
    expect(carla).toHaveTextContent("111.444.777-35");
    expect(carla).toHaveTextContent("(11) 91234-5678");
    expect(await within(carla).findByRole("img", { name: "Carla Colega" })).toHaveAttribute("src", "https://fotos/u-col/photo");
    expect(row("Antigo Vendedor")).toHaveTextContent(/revogado/i);
  });

  it("vendedor vê só nome e cargo dos colegas", async () => {
    loginAs(false);
    render(<CompanyPanel />);
    await screen.findByText("Dono Sul");
    expect(row("Dono Sul")).toHaveTextContent("Diretor");
    expect(screen.queryByText("529.982.247-25")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email do colega/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revogar|cancelar convite/i })).not.toBeInTheDocument();
  });

  it("convite pendente aparece com botão de cancelar", async () => {
    loginAs(true);
    render(<CompanyPanel />);
    const pending = (await screen.findByText("novo@sul.com")).closest("li")!;
    expect(pending).toHaveTextContent("Convite pendente");
    await userEvent.click(within(pending).getByRole("button", { name: /cancelar convite/i }));
    expect(fn.invokeEdgeFunction).toHaveBeenCalledWith("company-revoke-member", { userId: "u-novo" });
  });

  it("revogar chama company-revoke-member; dono e revogados não têm botão", async () => {
    loginAs(true);
    render(<CompanyPanel />);
    await screen.findByText("Carla Colega");
    expect(within(row("Dono Sul")).queryByRole("button")).toBeNull();
    expect(within(row("Antigo Vendedor")).queryByRole("button")).toBeNull();
    await userEvent.click(within(row("Carla Colega")).getByRole("button", { name: /revogar/i }));
    expect(fn.invokeEdgeFunction).toHaveBeenCalledWith("company-revoke-member", { userId: "u-col" });
  });

  it("convite sem limite de quantidade chama company-invite-colleague e recarrega", async () => {
    loginAs(true);
    render(<CompanyPanel />);
    await screen.findByText("Carla Colega");
    await userEvent.type(screen.getByLabelText(/email do colega/i), "outro@sul.com");
    await userEvent.click(screen.getByRole("button", { name: /^convidar$/i }));
    expect(fn.invokeEdgeFunction).toHaveBeenCalledWith("company-invite-colleague", { email: "outro@sul.com" });
    expect(await screen.findByRole("status")).toHaveTextContent(/outro@sul.com/);
    expect(members.listCompanyMembers).toHaveBeenCalledTimes(2);
  });

  it("erro da function aparece como mensagem amigável", async () => {
    loginAs(true);
    fn.invokeEdgeFunction.mockRejectedValue(new Error("Este email já tem cadastro no configurador."));
    render(<CompanyPanel />);
    await screen.findByText("Carla Colega");
    await userEvent.type(screen.getByLabelText(/email do colega/i), "dono@sul.com");
    await userEvent.click(screen.getByRole("button", { name: /^convidar$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/já tem cadastro/i);
  });
});
