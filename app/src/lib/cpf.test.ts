import { describe, expect, it } from "vitest";
import { formatCpf, formatPhone, isValidCpf, isValidPhone, normalizeCpf, normalizePhone } from "./cpf";

describe("CPF", () => {
  it("valida dígitos verificadores com ou sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("52998224726")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("normaliza e formata", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("5299")).toBe("529.9");
  });
});

describe("telefone", () => {
  it("aceita celular e fixo com DDD", () => {
    expect(isValidPhone("(11) 98765-4321")).toBe(true);
    expect(isValidPhone("(11) 3456-7890")).toBe(true);
    expect(isValidPhone("(01) 98765-4321")).toBe(false);
    expect(isValidPhone("98765-4321")).toBe(false);
  });
  it("normaliza e formata", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("11987654321");
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("1134567890")).toBe("(11) 3456-7890");
  });
});
