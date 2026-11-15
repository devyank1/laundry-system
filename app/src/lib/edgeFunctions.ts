import { supabase } from "./supabaseClient";

const GENERIC = "Não foi possível concluir a operação. Tente novamente.";

// Ponto único de chamada das Edge Functions (e de mock nos testes). O JWT do
// usuário logado vai junto automaticamente; a function reconfirma o papel.
// Erro: só a mensagem amigável que a function mandou em { error }, ou uma
// genérica — nunca o texto técnico do client.
export async function invokeEdgeFunction<TResponse>(name: string, body: unknown): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (!error) return data as TResponse;
  let message = GENERIC;
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const payload = (await context.json()) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error) message = payload.error;
    } catch {
      /* corpo não é JSON: fica a genérica */
    }
  }
  throw new Error(message);
}
