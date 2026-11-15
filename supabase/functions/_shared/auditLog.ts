import type { SupabaseClient } from "./supabaseAdmin.ts";

// Trilha de auditoria das ações sensíveis. Falha ao gravar o log não derruba
// a ação (já concluída), mas aparece nos logs da function.
export async function logAdminAction(params: {
  admin: SupabaseClient;
  actorId: string | null;
  action: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await params.admin
    .from("admin_actions_log")
    .insert({ actor_id: params.actorId, action: params.action, details: params.details ?? null });
  if (error) console.error("admin_actions_log insert failed", { action: params.action, code: error.code });
}
