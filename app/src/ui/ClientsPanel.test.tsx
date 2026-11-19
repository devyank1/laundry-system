import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Client } from "../clients/api";

const api = vi.hoisted(() => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(async () => {}),
  transferClient: vi.fn(async () => {}),
  deleteClient: vi.fn(async () => {}),
  duplicateOwner: vi.fn(async () => null as string | null),
  saveMeeting: vi.fn(async () => {}),
  loadMeetingLogo: vi.fn(async () => null),
}));
vi.mock("../clients/api", async (orig) => ({ ...(await orig<typeof import("../clients/api")>()), ...api }));
const meeting = vi.hoisted(() => ({ fp: "a", applyMeeting: vi.fn(() => ({ removed: [] as string[] })) }));
vi.mock("../clients/meeting", () => ({ meetingFingerprint: () => meeting.fp, applyMeeting: meeting.applyMeeting, captureMeeting: () => ({}) }));
vi.mock("../company/members", () => ({
  listCompanyMembers: async () => [
    { id: "u0", fullName: "Dono", active: true, registered: true, isOwner: true },
    { id: "u1", fullName: "Ana Um", active: true, registered: true, isOwner: false },
    { id: "u2", fullName: "Carla", active: true, registered: true, isOwner: false },
    { id: "u3", fullName: "Revogado", active: false, registered: true, isOwner: false },
  ],
}));
vi.mock("../catalog/store", () => ({ getCatalog: () => [] }));
const auth = vi.hoisted(() => ({ state: {} as { profile: unknown } }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.state }));

import { ClientsPanel } from "./ClientsPanel";
import { useMeetingSession } from "../clients/sessionStore";

const c1: Client = {
  id: "cl1", companyId: "c1", sellerId: "u1", sellerName: "Ana Um", name: "Lava Já", phone: "11987654321", email: "",
  cnpj: "", hasLocation: false, address: "", locationM2: "", notes: "", meeting: { v: 1 }, meetingSavedAt: "2026-11-19T10:00:00Z",
  logoPath: null, createdAt: "2026-11-19T10:00:00Z", updatedAt: "2026-11-19T10:00:00Z",
};

function as(id: string, isOwner: boolean) {
  auth.state = { profile: { id, role: "empresa", companyId: "c1", isOwner, active: true, fullName: "X", registrationComplete: true } };
}

beforeEach(() => {
  for (const f of Object.values(api)) f.mockClear();
  api.listClients.mockResolvedValue([c1]);
  api.duplicateOwner.mockResolvedValue(null);
  meeting.applyMeeting.mockReset().mockReturnValue({ removed: [] });
  meeting.fp = "a";
  useMeetingSession.getState().unbind();
});

describe("ClientsPanel (vendedor)", () => {
  beforeEach(() => as("u1", false));

  it("lista os próprios, sem planilha nem transferir", async () => {
    render(<ClientsPanel />);
    expect(await screen.findByText("Lava Já")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /baixar planilha/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /transferir/i })).not.toBeInTheDocument();
  });

  it("novo cliente sem contato mostra erro", async () => {
    render(<ClientsPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo cliente" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Fulano");
    await userEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe telefone ou email.");
    expect(api.createClient).not.toHaveBeenCalled();
  });

  it("CNPJ de colega avisa e ainda deixa salvar", async () => {
    api.duplicateOwner.mockResolvedValue("Carla");
    api.createClient.mockResolvedValue({ ...c1, id: "cl2", name: "Nova" });
    render(<ClientsPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo cliente" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Nova");
    await userEvent.type(screen.getByLabelText("Email"), "n@n.com");
    await userEvent.type(screen.getByLabelText("CNPJ"), "11222333000181");
    expect(await screen.findByText("Este cliente já está com Carla.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));
    await waitFor(() => expect(api.createClient).toHaveBeenCalledWith(expect.objectContaining({ name: "Nova", cnpj: "11.222.333/0001-81" }), "c1", "u1"));
  });

  it("Salvar reunião grava e liga a tela ao cliente", async () => {
    render(<ClientsPanel />);
    const row = (await screen.findByText("Lava Já")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Salvar reunião aqui" }));
    expect(screen.getByText("Este cliente já tem uma reunião salva. Substituir pela tela atual?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Substituir" }));
    await waitFor(() => expect(api.saveMeeting).toHaveBeenCalledWith(c1, null));
    expect(useMeetingSession.getState()).toMatchObject({ clientId: "cl1", canSave: true });
  });

  it("Abrir reunião com tela alterada pede confirmação", async () => {
    useMeetingSession.getState().unbind();
    meeting.fp = "mudou";
    render(<ClientsPanel />);
    const row = (await screen.findByText("Lava Já")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Abrir reunião" }));
    expect(screen.getByText("A tela tem alterações que não foram salvas. Abrir esta reunião vai substituí-las.")).toBeInTheDocument();
    expect(meeting.applyMeeting).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Abrir mesmo assim" }));
    await waitFor(() => expect(meeting.applyMeeting).toHaveBeenCalledWith({ v: 1 }, null));
    expect(useMeetingSession.getState()).toMatchObject({ clientId: "cl1", clientName: "Lava Já", canSave: true });
  });

  it("avisa máquinas retiradas do catálogo", async () => {
    meeting.applyMeeting.mockReturnValue({ removed: ["sq-velha"] });
    render(<ClientsPanel />);
    const row = (await screen.findByText("Lava Já")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Abrir reunião" }));
    expect(await screen.findByText("Algumas máquinas desta reunião não estão mais no catálogo e foram retiradas: sq-velha.")).toBeInTheDocument();
  });
});

describe("ClientsPanel (dono)", () => {
  beforeEach(() => as("u0", true));

  it("vê o vendedor e abre sem poder salvar por cima", async () => {
    render(<ClientsPanel />);
    expect(await screen.findByText(/Vendedor: Ana Um/)).toBeInTheDocument();
    const row = screen.getByText("Lava Já").closest("li")!;
    expect(within(row).queryByRole("button", { name: "Salvar reunião aqui" })).not.toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: "Abrir reunião" }));
    await waitFor(() => expect(useMeetingSession.getState()).toMatchObject({ clientId: "cl1", canSave: false }));
  });

  it("baixa a planilha", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ClientsPanel />);
    await screen.findByText("Lava Já");
    await userEvent.click(screen.getByRole("button", { name: "Baixar planilha (CSV)" }));
    expect(createObjectURL).toHaveBeenCalled();
    const a = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(a.download).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/);
    click.mockRestore();
  });

  it("transfere só pra membro ativo", async () => {
    render(<ClientsPanel />);
    const row = (await screen.findByText("Lava Já")).closest("li")!;
    const select = await within(row).findByLabelText("Transferir para");
    expect(within(select).queryByRole("option", { name: "Revogado" })).not.toBeInTheDocument();
    await userEvent.selectOptions(select, "u2");
    await userEvent.click(within(row).getByRole("button", { name: "Transferir" }));
    await waitFor(() => expect(api.transferClient).toHaveBeenCalledWith("cl1", "u2"));
  });

  it("exclui com confirmação", async () => {
    render(<ClientsPanel />);
    const row = (await screen.findByText("Lava Já")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Excluir" }));
    expect(api.deleteClient).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Excluir de vez" }));
    await waitFor(() => expect(api.deleteClient).toHaveBeenCalledWith(c1));
  });
});
