export type Role = "admin" | "empresa" | "cliente_fisico";

// "ok": liberado; "enroll": admin precisa cadastrar o celular; "verify":
// admin precisa digitar o código.
export type MfaState = "ok" | "enroll" | "verify";

export interface Profile {
  id: string;
  role: Role;
  companyId: string | null;
  isOwner: boolean;
  active: boolean;
  fullName: string | null;
  // Só conta pra empresa (dono e vendedores); os outros papéis não preenchem.
  registrationComplete: boolean;
  // Só preenchido pelo AuthProvider; admin sem "ok" não passa do RequireMfa.
  mfa?: MfaState;
}
