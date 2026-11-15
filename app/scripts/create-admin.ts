// Cria a conta fundadora (ADMIN). Roda uma vez, no terminal de quem
// administra — nunca no navegador. Não define senha: imprime um link de uso
// único pra própria pessoa definir a dela.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... APP_PUBLIC_URL=https://seu-dominio node scripts/create-admin.ts voce@empresa.com
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.APP_PUBLIC_URL ?? "http://localhost:5173").replace(/\/+$/, "");
const email = process.argv[2]?.trim().toLowerCase();

if (!url || !serviceRoleKey || !email) {
  console.error("Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... [APP_PUBLIC_URL=...] node scripts/create-admin.ts <email>");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

let link = await admin.auth.admin.generateLink({ type: "invite", email });
let type = "invite";
if (link.error) {
  // Já existe no Auth: gera link de redefinição.
  link = await admin.auth.admin.generateLink({ type: "recovery", email });
  type = "recovery";
}
if (link.error || !link.data.user) {
  console.error("Falha ao gerar o link:", link.error?.message);
  process.exit(1);
}

const { error } = await admin
  .from("profiles")
  .upsert({ id: link.data.user.id, role: "admin", company_id: null, is_owner: false, active: true });
if (error) {
  console.error("Falha ao gravar o perfil admin:", error.message);
  process.exit(1);
}

console.log(`Admin ${email} pronto. Abra este link (uso único) pra definir sua senha:`);
console.log(`${appUrl}/set-password?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}&type=${type}`);
