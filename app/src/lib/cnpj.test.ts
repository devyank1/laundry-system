import { describe, expect, it } from "vitest";
import { formatCnpj, isValidCnpj, normalizeCnpj } from "./cnpj";

describe("CNPJ", () => {
  it("valida dígitos verificadores com ou sem máscara", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11444777000161")).toBe(true);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
  });
  it("normaliza e formata", () => {
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("112223")).toBe("11.222.3");
  });
});
