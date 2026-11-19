import { describe, expect, it } from "vitest";
import { getCaller } from "./http.ts";
import type { SupabaseClient } from "./supabaseAdmin.ts";

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const token = `h.${b64url(JSON.stringify({ sub: "u1", session_id: "s-new" }))}.sig`;

function fakeAdmin(currentSession: string | null, registered: string | null = "2026-11-18T00:00:00Z", role = "empresa") {
  const rows: Record<string, unknown> = {
    profiles: { id: "u1", role, company_id: role === "empresa" ? "c1" : null, is_owner: role === "empresa", active: true, registration_completed_at: registered },
    user_sessions: currentSession ? { session_id: currentSession } : null,
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: rows[table], error: rows[table] ? null : { message: "none" } }),
          maybeSingle: async () => ({ data: rows[table], error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

function req() {
  return new Request("http://x", { headers: { Authorization: `Bearer ${token}` } });
}

describe("getCaller", () => {
  it("aceita quando o token é da sessão atual", async () => {
    expect(await getCaller(fakeAdmin("s-new"), req())).toEqual({ id: "u1", role: "empresa", companyId: "c1", isOwner: true });
  });
  it("recusa token de aparelho derrubado", async () => {
    expect(await getCaller(fakeAdmin("s-other"), req())).toBeNull();
  });
  it("recusa quando a conta não tem sessão reivindicada", async () => {
    expect(await getCaller(fakeAdmin(null), req())).toBeNull();
  });
  it("recusa conta de empresa sem cadastro completo", async () => {
    expect(await getCaller(fakeAdmin("s-new", null), req())).toBeNull();
  });
  it("admin não precisa de cadastro", async () => {
    expect(await getCaller(fakeAdmin("s-new", null, "admin"), req())).toMatchObject({ role: "admin" });
  });
});
