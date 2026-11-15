import { describe, expect, it } from "vitest";
import { brandedEmailHtml } from "./emailTemplate.ts";
import { normalizeEmail } from "./validation.ts";

describe("brandedEmailHtml", () => {
  it("escapa HTML vindo de dados (nome de empresa, etc.)", () => {
    const html = brandedEmailHtml({ heading: "<script>x</script>", intro: 'A & "B"', actionUrl: "https://app/x?a=1&b=2", actionLabel: "Ir" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; &quot;B&quot;");
    expect(html).toContain('href="https://app/x?a=1&amp;b=2"');
  });

  it("nunca contém a palavra senha seguida de valor (só link)", () => {
    const html = brandedEmailHtml({ heading: "Defina sua senha", intro: "Olá", actionUrl: "https://app/set-password?token_hash=t&type=invite", actionLabel: "Definir" });
    expect(html).toContain("set-password?token_hash=t&amp;type=invite");
  });
});

describe("normalizeEmail", () => {
  it("aceita email válido, normaliza caixa e espaços", () => {
    expect(normalizeEmail("  Fulano@Empresa.COM ")).toBe("fulano@empresa.com");
  });

  it("recusa valores que não são email", () => {
    expect(normalizeEmail("sem-arroba")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@x.com`)).toBeNull();
  });
});
