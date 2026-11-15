import { Component, type ErrorInfo, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { AuthContext, type AuthState } from "../auth/authContext";
import { ServerErrorPage } from "./ErrorPages";

const MAX_MESSAGE = 2000;
const MAX_STACK = 10000;

// Erro de render: o usuário vê só a página amigável; o detalhe técnico vai
// pra tabela client_errors (lida apenas pelo admin).
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  static contextType = AuthContext;
  declare context: AuthState | null;

  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const userId = this.context?.profile?.id;
    // Sem usuário a RLS recusaria o insert; o erro fica só no console.
    if (!userId) return;
    const stack = [error.stack, info.componentStack].filter(Boolean).join("\n");
    // Fire-and-forget: falha ao registrar não pode quebrar a página de erro.
    void Promise.resolve(
      supabase.from("client_errors").insert({
        user_id: userId,
        message: String(error.message ?? error).slice(0, MAX_MESSAGE),
        stack: stack.slice(0, MAX_STACK),
      }),
    ).catch(() => {});
  }

  render() {
    if (this.state.hasError) return <ServerErrorPage />;
    return this.props.children;
  }
}
