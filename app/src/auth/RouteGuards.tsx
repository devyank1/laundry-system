import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "./useAuth";
import { useSessionGuard } from "./useSessionGuard";
import { ForbiddenPage } from "../ui/ErrorPages";
import { CompleteRegistrationPage } from "../ui/CompleteRegistrationPage";
import { MfaPage } from "../ui/MfaPage";
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
  // Sessão única: aparelho derrubado volta pro login com o aviso.
  useSessionGuard(Boolean(profile));
  if (loading) return <AuthLoading />;
  if (!profile) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) return <ForbiddenPage />;
  return <>{children}</>;
}

// Admin só entra depois do código do celular (o banco também exige: aal2).
export function RequireMfa({ children }: { children: ReactNode }) {
  const { profile, signOut, refreshProfile } = useAuth();
  if (profile?.role === "admin" && profile.mfa !== "ok") {
    return <MfaPage mode={profile.mfa === "enroll" ? "enroll" : "verify"} onDone={refreshProfile} onSignOut={signOut} />;
  }
  return <>{children}</>;
}

// Conta de empresa sem cadastro completo só vê a tela de cadastro.
export function RequireRegistration({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  if (profile?.role === "empresa" && !profile.registrationComplete) return <CompleteRegistrationPage />;
  return <>{children}</>;
}
