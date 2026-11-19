import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthContext } from "../auth/authContext";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), from: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({ supabase: { from: mocks.from } }));

import { ErrorBoundary } from "./ErrorBoundary";

function Bomb(): never {
  throw new Error("boom: select * from secret_table");
}

beforeEach(() => {
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.from.mockReset().mockReturnValue({ insert: mocks.insert });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("captura erro de render, mostra ServerErrorPage (sem stack trace na tela) e insere em client_errors", () => {
    const profile = { id: "u1", role: "admin" as const, companyId: null, isOwner: false, active: true, fullName: null, registrationComplete: false };
    render(
      <AuthContext.Provider value={{ profile, loading: false, signOut: async () => {}, refreshProfile: async () => {} }}>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole("heading", { name: /algo deu errado/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/boom|secret_table|at Bomb/);
    expect(mocks.from).toHaveBeenCalledWith("client_errors");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", message: "boom: select * from secret_table", stack: expect.any(String) }),
    );
  });

  it("sem usuário logado mostra a página de erro e não tenta gravar (RLS recusaria)", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: /algo deu errado/i })).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("renderiza os filhos normalmente quando não há erro", () => {
    render(<ErrorBoundary><p>tudo certo</p></ErrorBoundary>);
    expect(screen.getByText("tudo certo")).toBeInTheDocument();
  });
});
