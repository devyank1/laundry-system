export type Role = "admin" | "empresa" | "cliente_fisico";

export interface Profile {
  id: string;
  role: Role;
  companyId: string | null;
  isOwner: boolean;
  active: boolean;
  fullName: string | null;
  // Só conta pra empresa (dono e vendedores); os outros papéis não preenchem.
  registrationComplete: boolean;
}
