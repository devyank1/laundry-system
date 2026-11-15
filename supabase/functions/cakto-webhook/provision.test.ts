import { beforeEach, describe, expect, it, vi } from "vitest";
import { provisionClienteFisico, type ProvisionDeps } from "./provision.ts";

let users: Map<string, string>; // email -> id
let profiles: Map<string, string>; // id -> role
let sent: string[];
let deps: ProvisionDeps;

beforeEach(() => {
  users = new Map();
  profiles = new Map();
  sent = [];
  deps = {
    findUserId: vi.fn(async (email: string) => users.get(email) ?? null),
    createInviteLink: vi.fn(async (email: string) => {
      const id = `u-${users.size + 1}`;
      users.set(email, id);
      return { userId: id, url: "invite-url" };
    }),
    createRecoveryLink: vi.fn(async (email: string) => ({ userId: users.get(email)!, url: "recovery-url" })),
    getRole: vi.fn(async (id: string) => profiles.get(id) ?? null),
    hasSignedIn: vi.fn(async () => false),
    insertProfile: vi.fn(async (id: string) => void profiles.set(id, "cliente_fisico")),
    sendEmail: vi.fn(async (email: string, url: string) => void sent.push(`${email}|${url}`)),
    deleteUser: vi.fn(async (id: string) => {
      for (const [e, uid] of users) if (uid === id) users.delete(e);
      profiles.delete(id);
    }),
  };
});

describe("provisionClienteFisico", () => {
  it("email novo: cria usuário + perfil e manda convite", async () => {
    expect(await provisionClienteFisico("a@b.com", deps)).toEqual({ created: true });
    expect(profiles.get("u-1")).toBe("cliente_fisico");
    expect(sent).toEqual(["a@b.com|invite-url"]);
  });

  it("email falha: desfaz usuário e perfil, e o reenvio manual entrega o acesso", async () => {
    deps.sendEmail = vi.fn(async () => {
      throw new Error("Resend respondeu 500");
    });
    await expect(provisionClienteFisico("a@b.com", deps)).rejects.toThrow();
    expect(users.size).toBe(0);
    expect(profiles.size).toBe(0);

    deps.sendEmail = vi.fn(async (email: string, url: string) => void sent.push(`${email}|${url}`));
    expect(await provisionClienteFisico("a@b.com", deps)).toEqual({ created: true });
    expect(sent).toEqual(["a@b.com|invite-url"]);
  });

  it("cliente físico que nunca entrou recebe novo link (recovery) sem duplicar conta", async () => {
    users.set("a@b.com", "u-9");
    profiles.set("u-9", "cliente_fisico");
    expect(await provisionClienteFisico("a@b.com", deps)).toEqual({ created: false });
    expect(sent).toEqual(["a@b.com|recovery-url"]);
    expect(deps.createInviteLink).not.toHaveBeenCalled();
  });

  it("conta que já tem papel e já entrou: não muda papel, não gera link, não manda email", async () => {
    users.set("dono@x.com", "u-7");
    profiles.set("u-7", "empresa");
    deps.hasSignedIn = vi.fn(async () => true);
    expect(await provisionClienteFisico("dono@x.com", deps)).toEqual({ created: false });
    expect(profiles.get("u-7")).toBe("empresa");
    expect(deps.createRecoveryLink).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("empresa convidada que ainda não entrou também não ganha link de cliente", async () => {
    users.set("dono@x.com", "u-7");
    profiles.set("u-7", "empresa");
    expect(await provisionClienteFisico("dono@x.com", deps)).toEqual({ created: false });
    expect(deps.createRecoveryLink).not.toHaveBeenCalled();
  });

  it("usuário no Auth sem perfil ganha perfil de cliente e link recovery", async () => {
    users.set("a@b.com", "u-5");
    expect(await provisionClienteFisico("a@b.com", deps)).toEqual({ created: true });
    expect(profiles.get("u-5")).toBe("cliente_fisico");
    expect(sent).toEqual(["a@b.com|recovery-url"]);
  });
});
