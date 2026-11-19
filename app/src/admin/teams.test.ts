import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ companies: vi.fn(), profiles: vi.fn(), update: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) =>
      table === "companies"
        ? { select: () => ({ order: mocks.companies }) }
        : {
            select: () => ({ eq: () => ({ order: mocks.profiles }) }),
            update: (values: unknown) => ({ eq: (_c: string, id: string) => ({ select: () => mocks.update(values, id) }) }),
          },
  },
}));

import { correctIdentity, listCompaniesWithTeams } from "./teams";

beforeEach(() => {
  mocks.companies.mockReset();
  mocks.profiles.mockReset();
  mocks.update.mockReset();
});

describe("admin teams", () => {
  it("agrupa a equipe por empresa", async () => {
    mocks.companies.mockResolvedValue({ data: [{ id: "c1", name: "Sul" }, { id: "c2", name: "Norte" }], error: null });
    mocks.profiles.mockResolvedValue({
      data: [{ id: "u1", company_id: "c1", full_name: "Ana", job_title: "V", email: "a@s", cpf: "1", phone: "2", photo_path: null, is_owner: true, active: true, registration_completed_at: "2026-11-18" }],
      error: null,
    });
    const result = await listCompaniesWithTeams();
    expect(result.map((c) => [c.name, c.members.length])).toEqual([["Sul", 1], ["Norte", 0]]);
    expect(result[0].members[0]).toMatchObject({ fullName: "Ana", isOwner: true, registered: true });
  });

  it("corrige nome e CPF; CPF repetido vira mensagem", async () => {
    mocks.update.mockResolvedValueOnce({ data: [{ id: "u1" }], error: null });
    await correctIdentity("u1", " Ana Lima ", "529.982.247-25");
    expect(mocks.update).toHaveBeenCalledWith({ full_name: "Ana Lima", cpf: "52998224725" }, "u1");
    mocks.update.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "profiles_cpf_active_uniq" } });
    await expect(correctIdentity("u1", "Ana", "52998224725")).rejects.toThrow("Este CPF já está em uso.");
  });
});
