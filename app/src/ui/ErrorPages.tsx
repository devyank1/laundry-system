import type { ReactNode } from "react";
import { LogoMark } from "./icons";
import "./statusPages.css";

// Páginas de erro: só texto amigável. Detalhe técnico nunca aparece aqui —
// vai pro log (client_errors / logs das Edge Functions).

function StatusPage({ code, title, children }: { code?: string; title: string; children: ReactNode }) {
  return (
    <main className="status-page">
      <div className="status-card">
        <LogoMark />
        {code && <p className="status-code">{code}</p>}
        <h1>{title}</h1>
        <div className="status-body">{children}</div>
        <a className="status-link" href="/">Voltar ao início</a>
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <StatusPage code="404" title="Página não encontrada">
      <p>O endereço que você abriu não existe ou mudou de lugar.</p>
    </StatusPage>
  );
}

export function ForbiddenPage() {
  return (
    <StatusPage code="403" title="Sem permissão">
      <p>Sua conta não tem acesso a esta parte do configurador.</p>
      <p>Se acha que isso é um engano, fale com quem administra o seu acesso.</p>
    </StatusPage>
  );
}

export function ServerErrorPage() {
  return (
    <StatusPage title="Algo deu errado">
      <p>Tivemos um problema ao carregar esta tela. Já registramos o ocorrido.</p>
      <p>Tente recarregar a página em alguns instantes.</p>
    </StatusPage>
  );
}

export function InviteExpiredPage() {
  return (
    <StatusPage title="Convite inválido ou expirado">
      <p>Este link de acesso já foi usado ou passou do prazo.</p>
      <p>Peça um novo convite a quem cadastrou você, ou use “Esqueci minha senha” na tela de login.</p>
    </StatusPage>
  );
}
