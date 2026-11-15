import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { useProjectStore } from "./state/projectStore";
import type { AuthState } from "./auth/useAuth";
import type { Role } from "./auth/types";

const auth = vi.hoisted(() => ({ state: null as unknown as AuthState }));
vi.mock("./auth/useAuth", () => ({ useAuth: () => auth.state }));

function loginAs(role: Role, isOwner = false) {
  auth.state = {
    profile: { id: "u1", role, companyId: role === "empresa" ? "c1" : null, isOwner, active: true },
    loading: false,
    signOut: async () => {},
  };
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

beforeEach(() => {
  loginAs("admin");
  localStorage.clear();
  useProjectStore.setState({
    roomWidthMm: 5000,
    roomDepthMm: 4200,
    ceilingHeightMm: 2400,
    machines: [{ catalogId: "sq-stack", qty: 2 }],
    doorEnabled: true,
    techAccessSide: "right",
    furnitureEnabled: true,
    totemSide: "left",
    tableSide: "left",
    chairsSide: "left",
    acSide: "left",
    acOverrideBTU: null,
  });
});

describe("App", () => {
  it("renderiza a planta 2D por padrão sem violações para um estado válido", () => {
    render(<App />);
    expect(screen.getByRole("img", { name: /planta baixa/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra o painel de violações quando o estado é inválido", () => {
    useProjectStore.setState({ roomWidthMm: 500 });
    render(<App />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("troca para a aba 3D ao clicar em Planta 3D", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<App />);
    await userEvent.setup().click(screen.getByRole("button", { name: /planta 3d/i }));
    expect(screen.getByRole("button", { name: /baixar imagem 3d/i })).toBeInTheDocument();
  });
});

describe("Modo inauguração", () => {
  it("alterna o botão e liga a fachada mesmo escondida", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    useProjectStore.setState({ facadeVisible: false, inauguracao: false });
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /planta 3d/i }));
    const btn = screen.getByRole("button", { name: /modo inauguração/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(useProjectStore.getState().inauguracao).toBe(true);
    // abre o 3D (import dinâmico): passa dos 5 s padrão com a suíte toda rodando
  }, 15_000);
});

describe("Acesso por papel", () => {
  it("admin vê ROI, Conectividade e Gerenciar máquinas", () => {
    loginAs("admin");
    render(<App />);
    expect(screen.getByRole("button", { name: /retorno \(roi\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conectividade/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerenciar máquinas/i })).toBeInTheDocument();
  });

  it("empresa vê ROI e Conectividade, mas não Gerenciar máquinas", () => {
    loginAs("empresa", true);
    render(<App />);
    expect(screen.getByRole("button", { name: /retorno \(roi\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conectividade/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gerenciar máquinas/i })).not.toBeInTheDocument();
  });

  it("cliente físico não vê ROI, Conectividade nem Gerenciar máquinas", () => {
    loginAs("cliente_fisico");
    render(<App />);
    expect(screen.getByRole("button", { name: /planta 2d/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retorno \(roi\)/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /conectividade/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gerenciar máquinas/i })).not.toBeInTheDocument();
  });

  it("tem botão Sair que chama signOut", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const signOut = vi.fn(async () => {});
    loginAs("cliente_fisico");
    auth.state = { ...auth.state, signOut };
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /sair/i }));
    expect(signOut).toHaveBeenCalled();
  });
});
