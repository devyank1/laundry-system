export type Role = "admin" | "empresa" | "cliente_fisico";

export interface Profile {
  id: string;
  role: Role;
  companyId: string | null;
  isOwner: boolean;
  active: boolean;
}
