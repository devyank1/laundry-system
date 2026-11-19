import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({ supabase: { rpc: mocks.rpc } }));

import { completeRegistration, updateMyContact } from "./registration";

const input = { fullName: "Ana Lima", cpf: "529.982.247-25", phone: "(11) 98765-4321", jobTitle: "Vendedora", photoPath: "u1/photo" };

beforeEach(() => mocks.rpc.mockReset());

describe("completeRegistration", () => {
  it("envia CPF e telefone só com dígitos", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await completeRegistration(input);
    expect(mocks.rpc).toHaveBeenCalledWith("complete_registration", {
      p_full_name: "Ana Lima",
      p_cpf: "52998224725",
      p_phone: "11987654321",
      p_job_title: "Vendedora",
      p_photo_path: "u1/photo",
    });
  });

  it("CPF já usado vira mensagem sem dizer de quem é", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "profiles_cpf_active_uniq"' } });
    await expect(completeRegistration(input)).rejects.toThrow("Este CPF já está em uso.");
  });

  it("telefone já usado", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "profiles_phone_active_uniq"' } });
    await expect(completeRegistration(input)).rejects.toThrow("Este telefone já está em uso.");
  });

  it("CPF e telefone inválidos no servidor", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "invalid_cpf" } });
    await expect(completeRegistration(input)).rejects.toThrow("CPF inválido.");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "invalid_phone" } });
    await expect(completeRegistration(input)).rejects.toThrow("Telefone inválido. Use DDD + número.");
  });
});

describe("updateMyContact", () => {
  it("envia telefone normalizado, cargo e foto", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await updateMyContact({ phone: "(21) 3456-7890", jobTitle: "Gerente", photoPath: "u1/photo" });
    expect(mocks.rpc).toHaveBeenCalledWith("update_my_contact", { p_phone: "2134567890", p_job_title: "Gerente", p_photo_path: "u1/photo" });
  });
});
