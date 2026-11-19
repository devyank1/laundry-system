import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ listCompaniesWithTeams: vi.fn(), correctIdentity: vi.fn(async () => {}) }));
vi.mock("../admin/teams", () => mocks);
vi.mock("../profile/photos", () => ({ photoUrl: async (p: string) => `https://fotos/${p}` }));

import { AdminTeamsPanel } from "./AdminTeamsPanel";

const member = {
  id: "u-col", fullName: "Carla Colega", jobTitle: "Vendedora", email: "carla@sul.com", cpf: "11144477735",
  phone: "11912345678", photoPath: "u-col/photo", isOwner: false, active: true, registered: true,
};

beforeEach(() => {
  mocks.listCompaniesWithTeams.mockReset().mockResolvedValue([
    { id: "c1", name: "Lavanderias Sul", members: [member] },
    { id: "c2", name: "Lava Norte", members: [] },
  ]);
  mocks.correctIdentity.mockReset().mockResolvedValue(undefined);
});

describe("AdminTeamsPanel", () => {
  it("lista empresas e equipes com CPF, telefone e foto", async () => {
    render(<AdminTeamsPanel />);
    expect(await screen.findByText("Lavanderias Sul")).toBeInTheDocument();
    expect(screen.getByText("Lava Norte")).toBeInTheDocument();
    const row = screen.getByText("Carla Colega").closest("li")!;
    expect(row).toHaveTextContent("111.444.777-35");
    expect(row).toHaveTextContent("(11) 91234-5678");
    expect(await within(row).findByRole("img", { name: "Carla Colega" })).toHaveAttribute("src", "https://fotos/u-col/photo");
  });

  it("corrigir nome/CPF: CPF inválido não envia; válido envia normalizado", async () => {
    render(<AdminTeamsPanel />);
    const row = (await screen.findByText("Carla Colega")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: /corrigir/i }));
    const cpf = within(row).getByLabelText(/cpf/i);
    await userEvent.clear(cpf);
    await userEvent.type(cpf, "52998224726");
    await userEvent.click(within(row).getByRole("button", { name: /salvar/i }));
    expect(within(row).getByRole("alert")).toHaveTextContent("CPF inválido.");
    expect(mocks.correctIdentity).not.toHaveBeenCalled();
    await userEvent.clear(cpf);
    await userEvent.type(cpf, "529.982.247-25");
    const name = within(row).getByLabelText(/nome/i);
    await userEvent.clear(name);
    await userEvent.type(name, "Carla Colega Souza");
    await userEvent.click(within(row).getByRole("button", { name: /salvar/i }));
    expect(mocks.correctIdentity).toHaveBeenCalledWith("u-col", "Carla Colega Souza", "52998224725");
    expect(mocks.listCompaniesWithTeams).toHaveBeenCalledTimes(2);
  });
});
