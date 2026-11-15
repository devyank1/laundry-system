import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: { auth: { signInWithPassword: mocks.signInWithPassword, resetPasswordForEmail: mocks.resetPasswordForEmail } },
}));

import { LoginPage } from "./LoginPage";

function renderLogin() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>home do app</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.signInWithPassword.mockReset();
  mocks.resetPasswordForEmail.mockReset();
});

describe("LoginPage", () => {
  it("mostra erro de credenciais inválidas sem detalhe técnico", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials", status: 400 } });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^senha/i), "errada123");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText("Email ou senha incorretos.")).toBeInTheDocument();
    expect(screen.queryByText(/invalid login credentials/i)).not.toBeInTheDocument();
  });

  it("chama signInWithPassword com email e senha digitados e navega pra / em caso de sucesso", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^senha/i), "certa1234");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "certa1234" });
    expect(await screen.findByText("home do app")).toBeInTheDocument();
  });

  it("esqueci minha senha envia o link de redefinição e mostra a mesma mensagem exista ou não a conta", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: "User not found" } });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.click(screen.getByRole("button", { name: /esqueci minha senha/i }));
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", expect.objectContaining({ redirectTo: expect.stringMatching(/\/set-password$/) }));
    expect(await screen.findByText(/se existir uma conta com esse email/i)).toBeInTheDocument();
    expect(screen.queryByText(/user not found/i)).not.toBeInTheDocument();
  });
});
