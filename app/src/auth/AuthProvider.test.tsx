import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void;

const mocks = vi.hoisted(() => ({
  callback: null as AuthCallback | null,
  signOut: vi.fn(async () => ({ error: null })),
  single: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCallback) => {
        mocks.callback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: mocks.signOut,
    },
    from: mocks.from,
  },
}));

import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";

function Probe() {
  const { profile, loading } = useAuth();
  return <p data-testid="state">{loading ? "loading" : profile ? `${profile.role}|${profile.companyId}|${profile.isOwner}` : "anon"}</p>;
}

function mockProfileRow(row: Record<string, unknown> | null) {
  mocks.single.mockResolvedValue({ data: row, error: row ? null : { message: "not found" } });
  mocks.eq.mockReturnValue({ single: mocks.single });
  mocks.from.mockReturnValue({ select: () => ({ eq: mocks.eq }) });
}

beforeEach(() => {
  mocks.callback = null;
  mocks.signOut.mockClear();
  mocks.from.mockReset();
});

describe("AuthProvider", () => {
  it("profile fica null e loading vira false quando não há sessão", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId("state")).toHaveTextContent("loading");
    mocks.callback?.("INITIAL_SESSION", null);
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("anon"));
  });

  it("carrega o profile da tabela profiles quando há sessão", async () => {
    mockProfileRow({ id: "u1", role: "empresa", company_id: "c1", is_owner: true, active: true });
    render(<AuthProvider><Probe /></AuthProvider>);
    mocks.callback?.("SIGNED_IN", { user: { id: "u1" } });
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("empresa|c1|true"));
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.eq).toHaveBeenCalledWith("id", "u1");
  });

  it("profile inativo (active=false) dispara signOut e profile fica null", async () => {
    mockProfileRow({ id: "u1", role: "empresa", company_id: "c1", is_owner: false, active: false });
    render(<AuthProvider><Probe /></AuthProvider>);
    mocks.callback?.("SIGNED_IN", { user: { id: "u1" } });
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(screen.getByTestId("state")).toHaveTextContent("anon");
  });

  it("usuário sem linha em profiles é deslogado", async () => {
    mockProfileRow(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    mocks.callback?.("SIGNED_IN", { user: { id: "u1" } });
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(screen.getByTestId("state")).toHaveTextContent("anon");
  });
});
