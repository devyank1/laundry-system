import { listCompanyMembers } from "../company/members";
import { isValidCnpj, normalizeCnpj } from "../lib/cnpj";
import { blobToDataUrl, dataUrlToBlob } from "../lib/logoImage";
import { supabase } from "../lib/supabaseClient";
import { captureMeeting } from "./meeting";

// Clientes (leads) da empresa. Quem vê/edita o quê é regra do servidor
// (RLS em `clients`); aqui só monta os pedidos e traduz erros.
const BUCKET = "client-logos";

export interface ClientInput {
  name: string;
  phone: string;
  email: string;
  cnpj: string;
  hasLocation: boolean;
  address: string;
  /** como digitado ("45,5"); vazio = não informado */
  locationM2: string;
  notes: string;
}

export interface Client extends ClientInput {
  id: string;
  companyId: string;
  sellerId: string;
  sellerName: string | null;
  meeting: unknown | null;
  meetingSavedAt: string | null;
  logoPath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientRow {
  id: string;
  company_id: string;
  seller_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  has_location: boolean;
  address: string | null;
  location_m2: number | null;
  notes: string | null;
  meeting: unknown | null;
  meeting_saved_at: string | null;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
}

const digits = (v: string) => v.replace(/\D/g, "");

function parseM2(v: string): number | null {
  const t = v.trim().replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

export function clientInputProblem(i: ClientInput): string | null {
  if (!i.name.trim()) return "Digite o nome do cliente.";
  if (!digits(i.phone) && !i.email.trim()) return "Informe telefone ou email.";
  const p = digits(i.phone);
  if (p && (p.length < 10 || p.length > 11)) return "Telefone inválido. Use DDD + número.";
  if (i.cnpj.trim() && !isValidCnpj(i.cnpj)) return "CNPJ inválido.";
  if (Number.isNaN(parseM2(i.locationM2))) return "Tamanho do ponto inválido.";
  return null;
}

function toRow(i: ClientInput) {
  return {
    name: i.name.trim(),
    phone: digits(i.phone) || null,
    email: i.email.trim() || null,
    cnpj: normalizeCnpj(i.cnpj) || null,
    has_location: i.hasLocation,
    address: i.address.trim() || null,
    location_m2: parseM2(i.locationM2),
    notes: i.notes.trim() || null,
  };
}

function fromRow(r: ClientRow, names: Map<string, string | null>): Client {
  return {
    id: r.id,
    companyId: r.company_id,
    sellerId: r.seller_id,
    sellerName: names.get(r.seller_id) ?? null,
    name: r.name,
    phone: r.phone ?? "",
    email: r.email ?? "",
    cnpj: r.cnpj ?? "",
    hasLocation: r.has_location,
    address: r.address ?? "",
    locationM2: r.location_m2 == null ? "" : String(r.location_m2).replace(".", ","),
    notes: r.notes ?? "",
    meeting: r.meeting,
    meetingSavedAt: r.meeting_saved_at,
    logoPath: r.logo_path,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function memberNames(): Promise<Map<string, string | null>> {
  try {
    return new Map((await listCompanyMembers()).map((m) => [m.id, m.fullName]));
  } catch {
    return new Map();
  }
}

export async function listClients(): Promise<Client[]> {
  const [{ data, error }, names] = await Promise.all([
    supabase.from("clients").select("*").order("updated_at", { ascending: false }),
    memberNames(),
  ]);
  if (error) throw new Error("Não foi possível carregar os clientes.");
  return ((data ?? []) as ClientRow[]).map((r) => fromRow(r, names));
}

export async function createClient(i: ClientInput, companyId: string, sellerId: string): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...toRow(i), company_id: companyId, seller_id: sellerId })
    .select()
    .single();
  if (error || !data) throw new Error("Não foi possível salvar o cliente.");
  return fromRow(data as ClientRow, await memberNames());
}

async function updateRow(id: string, values: Record<string, unknown>, message: string): Promise<void> {
  const { data, error } = await supabase.from("clients").update(values).eq("id", id).select();
  if (error || !data || (data as unknown[]).length === 0) throw new Error(message);
}

export function updateClient(id: string, i: ClientInput): Promise<void> {
  return updateRow(id, toRow(i), "Não foi possível salvar o cliente.");
}

export function transferClient(id: string, sellerId: string): Promise<void> {
  return updateRow(id, { seller_id: sellerId }, "Não foi possível transferir o cliente.");
}

export async function deleteClient(c: Client): Promise<void> {
  if (c.logoPath) await supabase.storage.from(BUCKET).remove([c.logoPath]);
  const { error } = await supabase.from("clients").delete().eq("id", c.id);
  if (error) throw new Error("Não foi possível excluir o cliente.");
}

export async function duplicateOwner(i: ClientInput, excludeId: string | null): Promise<string | null> {
  const cnpj = normalizeCnpj(i.cnpj);
  const phone = digits(i.phone);
  if (!cnpj && !phone) return null;
  const { data, error } = await supabase.rpc("client_duplicate_owner", {
    p_cnpj: cnpj || null,
    p_phone: phone || null,
    p_exclude: excludeId,
  });
  if (error) return null; // aviso é só ajuda: sem ele, segue
  return (data as string | null) ?? null;
}

export function logoPathFor(c: Pick<Client, "companyId" | "id">): string {
  return `${c.companyId}/${c.id}/logo`;
}

export async function saveMeeting(c: Client, logoDataUrl: string | null): Promise<void> {
  const path = logoPathFor(c);
  if (logoDataUrl) {
    const blob = dataUrlToBlob(logoDataUrl);
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw new Error("Não foi possível enviar a logo. Tente de novo.");
  }
  const { error } = await supabase.rpc("save_client_meeting", {
    p_client: c.id,
    p_meeting: captureMeeting(),
    p_logo_path: logoDataUrl ? path : null,
  });
  if (error) throw new Error("Não foi possível salvar a reunião.");
  // sem logo agora: apaga a antiga (depois de gravar, pra não perder se falhar)
  if (!logoDataUrl && c.logoPath) await supabase.storage.from(BUCKET).remove([c.logoPath]);
}

export async function loadMeetingLogo(c: Client): Promise<string | null> {
  if (!c.logoPath) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(c.logoPath);
  if (error || !data) return null;
  return blobToDataUrl(data);
}
