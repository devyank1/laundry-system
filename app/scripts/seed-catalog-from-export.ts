// Popula catalog_machines a partir do JSON que o botão "Exportar JSON" do
// Gerenciar máquinas gera (preserva as specs já ajustadas no navegador).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-catalog-from-export.ts catalogo-maquinas.json
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-catalog-from-export.ts --from-seed
//
// Roda só no terminal de quem administra: a chave service_role ignora a RLS
// e nunca pode ir pro navegador nem pro git.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCatalogJSON } from "../src/catalog/validate.ts";
import { CATALOG_SEED } from "../src/catalog/seed.ts";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const arg = process.argv[2];

if (!url || !serviceRoleKey || !arg) {
  console.error("Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-catalog-from-export.ts <arquivo.json | --from-seed>");
  process.exit(1);
}

const machines = arg === "--from-seed" ? CATALOG_SEED : parseCatalogJSON(readFileSync(arg, "utf8"));
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { error } = await admin.from("catalog_machines").upsert(machines.map((m) => ({ id: m.id, data: m })));
if (error) {
  console.error("Falha ao gravar catalog_machines:", error.message);
  process.exit(1);
}
console.log(`${machines.length} máquinas gravadas em catalog_machines.`);
