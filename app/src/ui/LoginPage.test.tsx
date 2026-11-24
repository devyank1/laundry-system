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

const session = vi.hoisted(() => ({
  loginAndClaim: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));
vi.mock("../auth/session", () => ({
  loginAndClaim: session.loginAndClaim,
  SESSION_REPLACED_MESSAGE: "Seu acesso neste aparelho foi encerrado porque a conta entrou em outro aparelho.",
}));

const captcha = vi.hoisted(() => ({ siteKey: "", resets: [] as number[] }));
vi.mock("../lib/turnstile", () => ({ turnstileSiteKey: () => captcha.siteKey }));
vi.mock("./TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken, resetSignal }: { onToken: (t: string | null) => void; resetSignal: number }) => {
    captcha.resets.push(resetSignal);
    return <button type="button" onClick={() => onToken("tok")}>resolver captcha</button>;
  },
}));

import { LoginPage } from "./LoginPage";

function renderLogin(url = "/login") {
  render(
    <MemoryRouter initialEntries={[url]}>
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
  captcha.siteKey = "";
  captcha.resets = [];
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
    expect(session.loginAndClaim).toHaveBeenCalled();
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

  it("mostra o aviso quando o aparelho foi derrubado por outro login", () => {
    renderLogin("/login?motivo=outro-aparelho");
    expect(screen.getByRole("status")).toHaveTextContent("Seu acesso neste aparelho foi encerrado porque a conta entrou em outro aparelho.");
  });

  it("sem site key do captcha não mostra widget", () => {
    renderLogin();
    expect(screen.queryByRole("button", { name: /resolver captcha/i })).not.toBeInTheDocument();
  });

  it("com captcha: Entrar só libera depois do captcha e manda o token", async () => {
    captcha.siteKey = "0xSITE";
    mocks.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^senha/i), "certa1234");
    expect(screen.getByRole("button", { name: /^entrar$/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /resolver captcha/i }));
    await userEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "certa1234", options: { captchaToken: "tok" } });
  });

  it("com captcha: tentativa errada reinicia o captcha (token é de uso único)", async () => {
    captcha.siteKey = "0xSITE";
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^senha/i), "errada123");
    await userEvent.click(screen.getByRole("button", { name: /resolver captcha/i }));
    await userEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(Math.max(...captcha.resets)).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^entrar$/i })).toBeDisabled();
  });

  it("com captcha: esqueci minha senha manda o token", async () => {
    captcha.siteKey = "0xSITE";
    mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.click(screen.getByRole("button", { name: /resolver captcha/i }));
    await userEvent.click(screen.getByRole("button", { name: /esqueci minha senha/i }));
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", expect.objectContaining({ captchaToken: "tok" }));
  });
});
