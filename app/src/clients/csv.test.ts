import { describe, expect, it } from "vitest";
import { CATALOG_SEED } from "../catalog/seed";
import { defaultRoiState } from "../roi/model";
import type { Client } from "./api";
import { CSV_HEADER, toCsv } from "./csv";

const base: Client = {
  id: "cl1", companyId: "c1", sellerId: "u1", sellerName: "Ana Um", name: "Lava Já", phone: "11987654321", email: "a@b.com",
  cnpj: "11222333000181", hasLocation: true, address: "Rua A, 10", locationM2: "45,5", notes: "", meeting: null,
  meetingSavedAt: null, logoPath: null, createdAt: "2026-11-19T10:00:00Z", updatedAt: "2026-11-19T13:30:00Z",
};

function rows(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
}

describe("toCsv", () => {
  it("BOM, cabeçalho exato, ponto e vírgula e CRLF", () => {
    const csv = toCsv([base], CATALOG_SEED);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(CSV_HEADER).toBe("Nome;Telefone;Email;CNPJ;Tem ponto;Endereço;Tamanho (m²);Observações;Vendedor;Criado em;Atualizado em;Área da planta (m²);Máquinas;Investimento (R$);Retorno (meses)");
    const [head, line] = rows(csv);
    expect(head).toBe(CSV_HEADER);
    expect(line).toBe("Lava Já;11987654321;a@b.com;11.222.333/0001-81;Sim;Rua A, 10;45,5;;Ana Um;19/11/2026 07:00;19/11/2026 10:30;;;;");
  });

  it("protege campos com ponto e vírgula, aspas e quebra de linha", () => {
    const csv = toCsv([{ ...base, hasLocation: false, notes: 'quer "2"; ligar\nsegunda' }], CATALOG_SEED);
    expect(csv).toContain(';Não;');
    expect(csv).toContain('"quer ""2""; ligar\nsegunda"');
  });

  it("evita fórmula no Excel", () => {
    expect(toCsv([{ ...base, name: "=HYPERLINK(1)" }], CATALOG_SEED)).toContain("'=HYPERLINK(1)");
  });

  it("resumo da reunião: área, máquinas, investimento e retorno", () => {
    const meeting = {
      v: 1,
      project: { roomWidthMm: 5000, roomDepthMm: 8000, machines: [{ catalogId: CATALOG_SEED[0].id, qty: 2 }] },
      roi: defaultRoiState(),
    };
    const cols = rows(toCsv([{ ...base, meeting }], CATALOG_SEED))[1].split(";");
    expect(cols[11]).toBe("40");
    expect(cols[12]).toMatch(/^2× /);
    expect(cols[13]).toMatch(/^\d+,\d{2}$/);
    expect(cols[14]).toMatch(/^(\d+,\d|Não paga)$/);
  });
});
