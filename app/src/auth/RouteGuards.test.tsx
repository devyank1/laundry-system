import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { AuthState } from "./useAuth";

const auth = vi.hoisted(() => ({ state: null as unknown as AuthState }));
vi.mock("./useAuth", () => ({ useAuth: () => auth.state }));

import { RequireAuth, RequireRole } from "./RouteGuards";

function setAuth(partial: Partial<AuthState>) {
  auth.state = { profile: null, loading: false, signOut: async () => {}, ...partial };
}

const admin = { id: "u1", role: "admin" as const, companyId: null, isOwner: false, active: true };
const empresa = { id: "u2", role: "empresa" as const, companyId: "c1", isOwner: true, active: true };

beforeEach(() => setAuth({}));

describe("RequireAuth", () => {
  it("redireciona pra /login quando profile é null e loading é false", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/login" element={<p>tela de login</p>} />
          <Route path="/" element={<RequireAuth><p>conteúdo protegido</p></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("tela de login")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });

  it("não redireciona nem mostra o conteúdo enquanto carrega", () => {
    setAuth({ loading: true });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/login" element={<p>tela de login</p>} />
          <Route path="/" element={<RequireAuth><p>conteúdo protegido</p></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText("tela de login")).not.toBeInTheDocument();
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });

  it("renderiza o conteúdo quando há profile", () => {
    setAuth({ profile: admin });
    render(<MemoryRouter><RequireAuth><p>conteúdo protegido</p></RequireAuth></MemoryRouter>);
    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });
});

describe("RequireRole", () => {
  it("mostra ForbiddenPage quando o papel do profile não está em roles", () => {
    setAuth({ profile: empresa });
    render(<MemoryRouter><RequireRole roles={["admin"]}><p>painel admin</p></RequireRole></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /sem permissão/i })).toBeInTheDocument();
    expect(screen.queryByText("painel admin")).not.toBeInTheDocument();
  });

  it("renderiza children quando o papel está em roles", () => {
    setAuth({ profile: admin });
    render(<MemoryRouter><RequireRole roles={["admin"]}><p>painel admin</p></RequireRole></MemoryRouter>);
    expect(screen.getByText("painel admin")).toBeInTheDocument();
  });
});
