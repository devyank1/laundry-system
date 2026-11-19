import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  uploadMyPhoto: vi.fn(async () => "u1/photo"),
  completeRegistration: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  order: [] as string[],
}));
vi.mock("../profile/photos", () => ({
  uploadMyPhoto: mocks.uploadMyPhoto,
  shrinkPhoto: async (f: File) => f,
  photoProblem: (f: File) => (f.size > 2 * 1024 * 1024 ? "A foto precisa ter até 2 MB." : null),
}));
vi.mock("../profile/registration", () => ({ completeRegistration: mocks.completeRegistration }));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", role: "empresa", companyId: "c1", isOwner: false, active: true, fullName: null, registrationComplete: false },
    loading: false,
    signOut: mocks.signOut,
    refreshProfile: mocks.refreshProfile,
  }),
}));

import { CompleteRegistrationPage } from "./CompleteRegistrationPage";

function photo(bytes = 1000) {
  return new File([new Uint8Array(bytes)], "eu.jpg", { type: "image/jpeg" });
}

async function fill({ cpf = "529.982.247-25", withPhoto = true, file = photo() } = {}) {
  await userEvent.type(screen.getByLabelText(/nome completo/i), "Ana Lima");
  await userEvent.type(screen.getByLabelText(/cpf/i), cpf);
  await userEvent.type(screen.getByLabelText(/telefone/i), "11987654321");
  await userEvent.type(screen.getByLabelText(/cargo/i), "Vendedora");
  if (withPhoto) await userEvent.upload(screen.getByLabelText(/foto/i), file);
  await userEvent.click(screen.getByRole("button", { name: /salvar e entrar/i }));
}

beforeEach(() => {
  mocks.order.length = 0;
  mocks.uploadMyPhoto.mockClear().mockImplementation(async () => {
    mocks.order.push("upload");
    return "u1/photo";
  });
  mocks.completeRegistration.mockClear().mockImplementation(async () => {
    mocks.order.push("complete");
  });
  mocks.refreshProfile.mockClear().mockImplementation(async () => {
    mocks.order.push("refresh");
  });
});

describe("CompleteRegistrationPage", () => {
  it("mostra o título e o aviso de LGPD", () => {
    render(<CompleteRegistrationPage />);
    expect(screen.getByRole("heading", { name: "Complete seu cadastro" })).toBeInTheDocument();
    expect(screen.getByText("Usamos estes dados só para identificar quem usa o configurador e controlar o acesso da sua empresa.")).toBeInTheDocument();
  });

  it("formata o CPF enquanto digita", async () => {
    render(<CompleteRegistrationPage />);
    await userEvent.type(screen.getByLabelText(/cpf/i), "52998224725");
    expect(screen.getByLabelText(/cpf/i)).toHaveValue("529.982.247-25");
  });

  it("não envia com CPF inválido", async () => {
    render(<CompleteRegistrationPage />);
    await fill({ cpf: "52998224726" });
    expect(screen.getByRole("alert")).toHaveTextContent("CPF inválido.");
    expect(mocks.completeRegistration).not.toHaveBeenCalled();
  });

  it("não envia sem foto", async () => {
    render(<CompleteRegistrationPage />);
    await fill({ withPhoto: false });
    expect(screen.getByRole("alert")).toHaveTextContent("Envie uma foto sua.");
    expect(mocks.uploadMyPhoto).not.toHaveBeenCalled();
  });

  it("recusa foto maior que 2 MB", async () => {
    render(<CompleteRegistrationPage />);
    await fill({ file: photo(3 * 1024 * 1024) });
    expect(screen.getByRole("alert")).toHaveTextContent("A foto precisa ter até 2 MB.");
    expect(mocks.uploadMyPhoto).not.toHaveBeenCalled();
  });

  it("envia a foto, salva o cadastro e recarrega o perfil, nessa ordem", async () => {
    render(<CompleteRegistrationPage />);
    await fill();
    await vi.waitFor(() => expect(mocks.refreshProfile).toHaveBeenCalled());
    expect(mocks.order).toEqual(["upload", "complete", "refresh"]);
    expect(mocks.completeRegistration).toHaveBeenCalledWith({
      fullName: "Ana Lima",
      cpf: "529.982.247-25",
      phone: "(11) 98765-4321",
      jobTitle: "Vendedora",
      photoPath: "u1/photo",
    });
  });

  it("mostra o erro do servidor (CPF em uso)", async () => {
    mocks.completeRegistration.mockRejectedValueOnce(new Error("Este CPF já está em uso."));
    render(<CompleteRegistrationPage />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Este CPF já está em uso.");
  });
});
