import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  calls: [] as string[],
  insert: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  select: vi.fn(),
  selectOne: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
}));
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...a: unknown[]) => {
      db.calls.push(`rpc:${a[0]}`);
      return db.rpc(...a);
    },
    from: () => ({
      select: (cols: string) => ({
        order: () => ({ range: (a: number, b: number) => db.select(cols, a, b) }),
        eq: (_c: string, id: string) => ({ single: () => db.selectOne(cols, id) }),
      }),
      insert: (row: unknown) => ({ select: () => ({ single: () => db.insert(row) }) }),
      update: (values: unknown) => ({ eq: (_c: string, id: string) => ({ select: () => db.update(values, id) }) }),
      delete: () => ({
        eq: (_c: string, id: string) => {
          db.calls.push("delete");
          return db.del(id);
        },
      }),
    }),
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => {
          db.calls.push("upload");
          return db.upload(...a);
        },
        remove: (paths: string[]) => {
          db.calls.push("remove");
          return db.remove(paths);
        },
        download: (p: string) => db.download(p),
      }),
    },
  },
}));
vi.mock("../company/members", () => ({
  listCompanyMembers: async () => [{ id: "u1", fullName: "Ana Um", active: true }],
}));
vi.mock("./meeting", () => ({ captureMeeting: () => ({ v: 1, project: {}, roi: {}, insights: {} }) }));

import { clientInputProblem, createClient, deleteClient, duplicateOwner, listClients, loadMeeting, loadMeetingLogo, saveMeeting, type Client, type ClientInput } from "./api";

const input: ClientInput = { name: "Lava Já", phone: "(11) 98765-4321", email: "", cnpj: "11.222.333/0001-81", hasLocation: true, address: "Rua A, 10", locationM2: "45,5", notes: "" };
const row = { id: "cl1", company_id: "c1", seller_id: "u1", name: "Lava Já", phone: "11987654321", email: null, cnpj: "11222333000181", has_location: true, address: "Rua A, 10", location_m2: 45.5, notes: null, meeting: null, meeting_saved_at: null, logo_path: null, created_at: "2026-11-19T10:00:00Z", updated_at: "2026-11-19T10:00:00Z" };
const client = { id: "cl1", companyId: "c1", sellerId: "u1", logoPath: "c1/cl1/logo" } as Client;

beforeEach(() => {
  db.calls.length = 0;
  for (const f of [db.selectOne, db.insert, db.update, db.del, db.select, db.rpc, db.upload, db.remove, db.download]) f.mockReset();
  db.rpc.mockResolvedValue({ data: null, error: null });
  db.upload.mockResolvedValue({ data: {}, error: null });
  db.remove.mockResolvedValue({ data: [], error: null });
  db.del.mockResolvedValue({ error: null });
});

describe("clientInputProblem", () => {
  it("cobre cada mensagem", () => {
    expect(clientInputProblem({ ...input, name: " " })).toBe("Digite o nome do cliente.");
    expect(clientInputProblem({ ...input, phone: "", email: "" })).toBe("Informe telefone ou email.");
    expect(clientInputProblem({ ...input, phone: "123" })).toBe("Telefone inválido. Use DDD + número.");
    expect(clientInputProblem({ ...input, cnpj: "11.111.111/1111-11" })).toBe("CNPJ inválido.");
    expect(clientInputProblem({ ...input, locationM2: "abc" })).toBe("Tamanho do ponto inválido.");
    expect(clientInputProblem({ ...input, phone: "", email: "a@b.com", cnpj: "", locationM2: "" })).toBeNull();
  });
});

describe("api", () => {
  it("createClient manda telefone/CNPJ só com dígitos e m² como número", async () => {
    db.insert.mockResolvedValue({ data: row, error: null });
    const c = await createClient(input, "c1", "u1");
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ company_id: "c1", seller_id: "u1", phone: "11987654321", cnpj: "11222333000181", location_m2: 45.5, email: null, has_location: true }));
    expect(c).toMatchObject({ id: "cl1", name: "Lava Já", sellerId: "u1", locationM2: "45,5" });
  });

  it("listClients junta o nome do vendedor e não baixa as reuniões", async () => {
    db.select.mockResolvedValue({ data: [row], error: null });
    const list = await listClients();
    expect(list[0]).toMatchObject({ sellerName: "Ana Um", phone: "11987654321" });
    expect(db.select.mock.calls[0][0]).not.toContain("meeting,");
    expect(db.select.mock.calls[0][0]).toContain("meeting_saved_at");
  });

  it("listClients busca todas as páginas (passa de 1000)", async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ ...row, id: `p${i}` }));
    db.select.mockResolvedValueOnce({ data: page, error: null }).mockResolvedValueOnce({ data: [row], error: null });
    const list = await listClients({ withMeeting: true });
    expect(list).toHaveLength(1001);
    expect(db.select.mock.calls.map((c) => [c[1], c[2]])).toEqual([[0, 999], [1000, 1999]]);
    expect(db.select.mock.calls[0][0]).toContain("meeting");
  });

  it("loadMeeting busca a reunião na hora de abrir", async () => {
    db.selectOne.mockResolvedValue({ data: { meeting: { v: 1 } }, error: null });
    expect(await loadMeeting("cl1")).toEqual({ v: 1 });
  });

  it("logo que não baixa impede abrir (senão o próximo salvar apagaria a logo)", async () => {
    db.download.mockResolvedValue({ data: null, error: { message: "rede" } });
    await expect(loadMeetingLogo(client)).rejects.toThrow("Não foi possível baixar a logo desta reunião. Tente de novo.");
  });

  it("saveMeeting sobe a logo antes de gravar a reunião", async () => {
    await saveMeeting({ ...client, logoPath: null }, "data:image/webp;base64,UklG");
    expect(db.calls).toEqual(["upload", "rpc:save_client_meeting"]);
    expect(db.upload).toHaveBeenCalledWith("c1/cl1/logo", expect.any(Blob), { upsert: true, contentType: "image/webp" });
    expect(db.rpc).toHaveBeenCalledWith("save_client_meeting", { p_client: "cl1", p_meeting: expect.objectContaining({ v: 1 }), p_logo_path: "c1/cl1/logo" });
  });

  it("saveMeeting sem logo grava logo nula e depois apaga a antiga", async () => {
    await saveMeeting(client, null);
    expect(db.calls).toEqual(["rpc:save_client_meeting", "remove"]);
    expect(db.rpc).toHaveBeenCalledWith("save_client_meeting", expect.objectContaining({ p_logo_path: null }));
  });

  it("deleteClient remove a logo antes da linha", async () => {
    await deleteClient(client);
    expect(db.calls).toEqual(["remove", "delete"]);
    expect(db.remove).toHaveBeenCalledWith(["c1/cl1/logo"]);
  });

  it("duplicateOwner manda só dígitos e devolve o nome", async () => {
    db.rpc.mockResolvedValue({ data: "Carla", error: null });
    expect(await duplicateOwner(input, "cl9")).toBe("Carla");
    expect(db.rpc).toHaveBeenCalledWith("client_duplicate_owner", { p_cnpj: "11222333000181", p_phone: "11987654321", p_exclude: "cl9" });
  });
});
