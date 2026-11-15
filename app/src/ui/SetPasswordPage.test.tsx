import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: { auth: { verifyOtp: mocks.verifyOtp, updateUser: mocks.updateUser } },
}));

import { SetPasswordPage } from "./SetPasswordPage";

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/" element={<p>home do app</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.verifyOtp.mockReset();
  mocks.updateUser.mockReset();
});

describe("SetPasswordPage", () => {
  it("link inválido ou expirado mostra InviteExpiredPage, não trava nem lança erro", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: {}, error: { message: "Token has expired or is invalid" } });
    renderAt("/set-password?token_hash=abc&type=invite");
    expect(await screen.findByRole("heading", { name: /convite inválido ou expirado/i })).toBeInTheDocument();
    expect(screen.queryByText(/token has expired/i)).not.toBeInTheDocument();
  });

  it("link sem token_hash mostra InviteExpiredPage sem chamar o servidor", async () => {
    renderAt("/set-password");
    expect(await screen.findByRole("heading", { name: /convite inválido ou expirado/i })).toBeInTheDocument();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("tipo de link desconhecido mostra InviteExpiredPage sem chamar o servidor", async () => {
    renderAt("/set-password?token_hash=abc&type=signup");
    expect(await screen.findByRole("heading", { name: /convite inválido ou expirado/i })).toBeInTheDocument();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("troca o token da URL por sessão e permite definir a nova senha", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    renderAt("/set-password?token_hash=abc&type=invite");
    const nova = await screen.findByLabelText(/^nova senha/i);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "invite" });
    await userEvent.type(nova, "Senha1234");
    await userEvent.type(screen.getByLabelText(/confirme/i), "Senha1234");
    await userEvent.click(screen.getByRole("button", { name: /salvar senha/i }));
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "Senha1234" });
    expect(await screen.findByText("home do app")).toBeInTheDocument();
  });

  it("aceita link de redefinição (type=recovery)", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    renderAt("/set-password?token_hash=xyz&type=recovery");
    await screen.findByLabelText(/^nova senha/i);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "xyz", type: "recovery" });
  });

  it("senha e confirmação diferentes mostra erro de validação sem chamar updateUser", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    renderAt("/set-password?token_hash=abc&type=invite");
    await userEvent.type(await screen.findByLabelText(/^nova senha/i), "Senha1234");
    await userEvent.type(screen.getByLabelText(/confirme/i), "Outra1234");
    await userEvent.click(screen.getByRole("button", { name: /salvar senha/i }));
    expect(await screen.findByText(/as senhas não conferem/i)).toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("senha fraca (menos de 8 ou sem letra e número) é recusada sem chamar updateUser", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    renderAt("/set-password?token_hash=abc&type=invite");
    await userEvent.type(await screen.findByLabelText(/^nova senha/i), "12345678");
    await userEvent.type(screen.getByLabelText(/confirme/i), "12345678");
    await userEvent.click(screen.getByRole("button", { name: /salvar senha/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/pelo menos 8 caracteres/i);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
