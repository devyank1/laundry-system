import type { CatalogMachine, MachineSelection } from "../engine/types";
import { formatCnpj } from "../lib/cnpj";
import { plantMachines } from "../plantLink";
import { computeRoi } from "../roi/model";
import { normalizeRoi } from "../roi/roiStore";
import type { Client } from "./api";

// Planilha pro CRM da empresa: Excel BR abre direto (BOM + ";" + CRLF).
export const CSV_HEADER =
  "Nome;Telefone;Email;CNPJ;Tem ponto;Endereço;Tamanho (m²);Observações;Vendedor;Criado em;Atualizado em;Área da planta (m²);Máquinas;Investimento (R$);Retorno (meses)";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function cell(v: string): string {
  // texto começando com = + - @ vira fórmula no Excel
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const br = (n: number, digits: number) => n.toFixed(digits).replace(".", ",");

function summary(meeting: unknown, catalog: CatalogMachine[]): string[] {
  if (!meeting || typeof meeting !== "object") return ["", "", "", ""];
  const m = meeting as { project?: { roomWidthMm?: unknown; roomDepthMm?: unknown; machines?: unknown }; roi?: unknown };
  const w = Number(m.project?.roomWidthMm);
  const d = Number(m.project?.roomDepthMm);
  const area = w > 0 && d > 0 ? String(Math.round((w * d) / 1e5) / 10).replace(".", ",") : "";
  const selection = Array.isArray(m.project?.machines) ? (m.project.machines as MachineSelection[]) : [];
  const machines = plantMachines(selection, catalog).map((p) => `${p.qty}× ${p.label}`).join(" + ");
  let inv = "";
  let pb = "";
  try {
    const r = computeRoi(normalizeRoi(m.roi));
    inv = br(r.inv, 2);
    pb = r.pb == null ? "Não paga" : br(r.pb, 1);
  } catch {
    /* ROI ilegível: deixa vazio */
  }
  return [area, machines, inv, pb];
}

export function toCsv(clients: Client[], catalog: CatalogMachine[]): string {
  const lines = clients.map((c) =>
    [
      c.name,
      c.phone,
      c.email,
      c.cnpj ? formatCnpj(c.cnpj) : "",
      c.hasLocation ? "Sim" : "Não",
      c.address,
      c.locationM2,
      c.notes,
      c.sellerName ?? "",
      dateFmt.format(new Date(c.createdAt)).replace(", ", " "),
      dateFmt.format(new Date(c.updatedAt)).replace(", ", " "),
      ...summary(c.meeting, catalog),
    ]
      .map(cell)
      .join(";"),
  );
  return "﻿" + [CSV_HEADER, ...lines].join("\r\n") + "\r\n";
}
