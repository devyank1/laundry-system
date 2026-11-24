// Lê o session_id do JWT sem verificar assinatura: quem chama já validou o
// token com auth.getUser(). Usado pra checar a sessão única nas functions.
export function jwtSessionId(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { session_id?: unknown };
    return typeof payload.session_id === "string" && payload.session_id ? payload.session_id : null;
  } catch {
    return null;
  }
}

// Nível de verificação da sessão: "aal1" (só senha) ou "aal2" (senha + código
// do celular). Mesma premissa: o token já foi validado com auth.getUser().
export function jwtAal(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { aal?: unknown };
    return typeof payload.aal === "string" && payload.aal ? payload.aal : null;
  } catch {
    return null;
  }
}
