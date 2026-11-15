import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./supabaseClient", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));

import { invokeEdgeFunction } from "./edgeFunctions";

beforeEach(() => mocks.invoke.mockReset());

describe("invokeEdgeFunction", () => {
  it("devolve data quando a function responde ok", async () => {
    mocks.invoke.mockResolvedValue({ data: { companyId: "c1" }, error: null });
    await expect(invokeEdgeFunction("admin-create-company", { a: 1 })).resolves.toEqual({ companyId: "c1" });
    expect(mocks.invoke).toHaveBeenCalledWith("admin-create-company", { body: { a: 1 } });
  });

  it("usa a mensagem amigável que a function mandou no corpo do erro", async () => {
    const context = new Response(JSON.stringify({ error: "Este email já tem cadastro." }), { status: 409 });
    mocks.invoke.mockResolvedValue({ data: null, error: { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context } });
    await expect(invokeEdgeFunction("x", {})).rejects.toThrow("Este email já tem cadastro.");
  });

  it("sem mensagem amigável, lança uma genérica (nunca o texto técnico)", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { name: "FunctionsFetchError", message: "Failed to send a request to the Edge Function" } });
    await expect(invokeEdgeFunction("x", {})).rejects.toThrow("Não foi possível concluir a operação. Tente novamente.");
  });
});
