import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "./useAuth";
import { ForbiddenPage } from "../ui/ErrorPages";
import type { Role } from "./types";

export function AuthLoading() {
  return (
    <div className="status-loading" role="status">
      Carregando…
    </div>
  );
}

// Guards só decidem o que a tela mostra. A proteção de verdade está na RLS e
// nas Edge Functions: quem burlar a UI ainda leva "negado" do servidor.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!profile) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) return <ForbiddenPage />;
  return <>{children}</>;
}
