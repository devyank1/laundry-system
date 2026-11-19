import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  loadMyData: vi.fn(),
  updateMyContact: vi.fn(async () => {}),
  uploadMyPhoto: vi.fn(async () => "u1/photo"),
  order: [] as string[],
}));
vi.mock("../profile/registration", () => ({ loadMyData: mocks.loadMyData, updateMyContact: mocks.updateMyContact }));
vi.mock("../profile/photos", () => ({
  uploadMyPhoto: mocks.uploadMyPhoto,
  photoUrl: async () => "https://x/foto.jpg",
  shrinkPhoto: async (f: File) => f,
  photoProblem: () => null,
}));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", role: "empresa", companyId: "c1", isOwner: false, active: true, fullName: "Ana Lima", registrationComplete: true },
    loading: false,
    signOut: async () => {},
    refreshProfile: async () => {},
  }),
}));

import { MyDataPanel } from "./MyDataPanel";

beforeEach(() => {
  mocks.order.length = 0;
  mocks.loadMyData.mockResolvedValue({ fullName: "Ana Lima", cpf: "52998224725", phone: "11987654321", jobTitle: "Vendedora", photoPath: "u1/photo" });
  mocks.updateMyContact.mockReset().mockImplementation(async () => {
    mocks.order.push("update");
  });
  mocks.uploadMyPhoto.mockClear().mockImplementation(async () => {
    mocks.order.push("upload");
    return "u1/photo";
  });
});

describe("MyDataPanel", () => {
  it("mostra nome e CPF só para leitura", async () => {
    render(<MyDataPanel />);
    expect(await screen.findByText("Ana Lima")).toBeInTheDocument();
    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
    expect(screen.queryByLabelText(/cpf/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument();
  });

  it("salva telefone e cargo", async () => {
    render(<MyDataPanel />);
    const phone = await screen.findByLabelText(/telefone/i);
    expect(phone).toHaveValue("(11) 98765-4321");
    await userEvent.clear(phone);
    await userEvent.type(phone, "2134567890");
    await userEvent.clear(screen.getByLabelText(/cargo/i));
    await userEvent.type(screen.getByLabelText(/cargo/i), "Gerente");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));
    expect(mocks.updateMyContact).toHaveBeenCalledWith({ phone: "(21) 3456-7890", jobTitle: "Gerente", photoPath: "u1/photo" });
    expect(await screen.findByRole("status")).toHaveTextContent("Dados salvos.");
    expect(mocks.uploadMyPhoto).not.toHaveBeenCalled();
  });

  it("trocar a foto envia antes de salvar", async () => {
    render(<MyDataPanel />);
    await screen.findByLabelText(/telefone/i);
    await userEvent.upload(screen.getByLabelText(/foto/i), new File(["x"], "f.jpg", { type: "image/jpeg" }));
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));
    await vi.waitFor(() => expect(mocks.updateMyContact).toHaveBeenCalled());
    expect(mocks.order).toEqual(["upload", "update"]);
  });

  it("mostra erro de telefone em uso", async () => {
    mocks.updateMyContact.mockRejectedValueOnce(new Error("Este telefone já está em uso."));
    render(<MyDataPanel />);
    await screen.findByLabelText(/telefone/i);
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Este telefone já está em uso.");
  });
});
