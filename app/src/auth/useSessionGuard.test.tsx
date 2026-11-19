import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

const mocks = vi.hoisted(() => ({ isCurrentSession: vi.fn(), signOut: vi.fn(async () => ({ error: null })) }));
vi.mock("./session", () => ({ isCurrentSession: mocks.isCurrentSession }));
vi.mock("../lib/supabaseClient", () => ({ supabase: { auth: { signOut: mocks.signOut } } }));

import { useSessionGuard } from "./useSessionGuard";

function Guarded({ active }: { active: boolean }) {
  useSessionGuard(active);
  return <p>app</p>;
}
function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderGuard(active: boolean) {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Guarded active={active} />} />
        <Route path="/login" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.isCurrentSession.mockReset();
  mocks.signOut.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("useSessionGuard", () => {
  it("checa a cada 20 s e derruba com aviso quando a sessão foi tomada", async () => {
    mocks.isCurrentSession.mockResolvedValueOnce(true).mockResolvedValue(false);
    renderGuard(true);
    await flush();
    expect(screen.getByText("app")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });
    await flush();
    expect(screen.getByTestId("where").textContent).toBe("/login?motivo=outro-aparelho");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("checa ao abrir (recarregar a página no aparelho antigo derruba na hora)", async () => {
    mocks.isCurrentSession.mockResolvedValue(false);
    renderGuard(true);
    await flush();
    expect(screen.getByTestId("where").textContent).toBe("/login?motivo=outro-aparelho");
  });

  it("checa quando a janela volta ao foco", async () => {
    mocks.isCurrentSession.mockResolvedValue(true);
    renderGuard(true);
    await flush();
    const calls = mocks.isCurrentSession.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(mocks.isCurrentSession.mock.calls.length).toBe(calls + 1);
  });

  it("não checa nada sem usuário logado", async () => {
    renderGuard(false);
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(mocks.isCurrentSession).not.toHaveBeenCalled();
  });
});
