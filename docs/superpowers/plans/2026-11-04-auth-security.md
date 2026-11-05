# Login, Papéis e Segurança — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real login (3 papéis: admin/empresa/cliente_fisico) com Supabase (Postgres + Auth + RLS + Edge Functions), migrar o catálogo de máquinas do localStorage pra uma tabela protegida, provisionar contas automaticamente (ADMIN cadastra empresa, dono convida colegas, webhook da Cakto cria cliente físico), e trocar as telas sem proteção/sem roteamento de hoje por rotas reais com páginas de erro próprias.

**Architecture:** O front continua Vite + React SPA estático; `@supabase/supabase-js` entra como client do Postgres+Auth, `react-router` entra pra dar URL própria a login/erros/definir-senha. Toda ação privilegiada (criar empresa, convidar, processar webhook da Cakto) vira uma Supabase Edge Function (roda com a chave service-role, nunca exposta ao navegador); o front só chama essas functions e faz leitura direta nas tabelas via RLS.

**Tech Stack:** React 19, Vite 8, TypeScript, zustand (já em uso), `@supabase/supabase-js`, `react-router`, Supabase Edge Functions (Deno), Postgres (via Supabase), Resend (email transacional), vitest + @testing-library/react (já em uso).

**Spec:** `docs/superpowers/specs/2026-11-04-auth-security-design.md`

## Global Constraints

- Senha nunca em texto puro em email, log ou banco — hash+salt feito pelo Supabase Auth; toda conta criada pelo sistema recebe só um link de "defina sua senha" (`inviteUserByEmail`/`generateLink`), nunca senha pronta.
- Nenhuma chave `service_role` do Supabase entra no bundle do frontend — só a chave anônima (`VITE_SUPABASE_ANON_KEY`), que é pública por design. `service_role` só existe dentro de Edge Functions (`Deno.env`).
- RLS obrigatório em `profiles`, `companies`, `company_machines`, `catalog_machines` — nenhuma dessas tabelas aceita leitura/escrita sem policy explícita.
- Catálogo de máquinas sai do `localStorage`; escrita só por `admin`; leitura de `empresa` filtrada ao subconjunto de `company_machines` dela; `cliente_fisico`/`admin` leem o catálogo completo.
- Webhook da Cakto: validar `X-Cakto-Signature` (`v1=<hmac-sha256 de "{timestamp}.{corpo cru}">`) e `X-Cakto-Timestamp` (rejeitar se `|now - timestamp| > 300s`); idempotência por `data.id`; responder 2xx em até 8s.
- Checagem de papel/permissão nunca só na UI — todo guard de rota e toda Edge Function reconfirma o papel no servidor (RLS ou leitura de `profiles` dentro da function).
- Página de erro (404 / sem permissão / 500 / convite inválido-expirado) nunca mostra stack trace, SQL ou detalhe de infraestrutura pro usuário; o detalhe técnico vai só pro log do servidor (Supabase logs, ou a tabela `client_errors`/`admin_actions_log` deste plano).
- Nada de ROI, Conectividade ou o motor de planta (`engine/`) migra pro backend — permanecem 100% client-side, como hoje.
- Domínio próprio ainda não existe: usar `http://localhost:5173` como `APP_PUBLIC_URL` e o sender de sandbox do Resend como `EMAIL_FROM` por enquanto; trocar os dois quando o domínio (Hostinger) e a verificação de domínio no Resend existirem — isso é configuração de ambiente, não uma tarefa de código deste plano.

## Review Focus

- **Link de convite/reset expirado ou já usado**: a página de definir senha deve mostrar "convite inválido ou expirado", nunca travar em branco ou lançar um erro não tratado (Task 6).
- **Colega revogado continua com uma sessão ainda válida no navegador**: qualquer leitura feita por ele depois da revogação deve voltar vazia/negada (RLS filtrando por `profiles.active = true`), não só a UI escondendo o botão (Task 2, Task 13).
- **Cakto reenvia o mesmo `purchase_approved` (retry/replay)**: segunda entrega com o mesmo `data.id` não deve criar uma segunda conta nem mandar um segundo email (Task 11).
- **Alguém chama o endpoint do webhook sem a assinatura certa (ou com timestamp antigo)**: deve ser rejeitado antes de qualquer escrita no banco (Task 11).
- **Empresa tenta abrir a rota de ROI/Conectividade/Painel Admin direto pela URL**, não só clicando numa aba escondida: o guard de rota deve bloquear e mandar pra página de "sem permissão" (Task 4).

---

## File Structure

**Banco / Supabase (novo):**
- `supabase/migrations/0001_auth_schema.sql` — tabelas, `current_profile()`, policies de RLS.
- `supabase/functions/_shared/caktoSignature.ts` — verificação de assinatura HMAC do webhook (puro, testável).
- `supabase/functions/_shared/supabaseAdmin.ts` — client service-role pras Edge Functions.
- `supabase/functions/_shared/resend.ts` — envio de email transacional de marca.
- `supabase/functions/_shared/auditLog.ts` — grava em `admin_actions_log`.
- `supabase/functions/cakto-webhook/index.ts` — recebe `purchase_approved`, cria `cliente_fisico`.
- `supabase/functions/admin-create-company/index.ts` — ADMIN cria empresa + catálogo dela + convida dono.
- `supabase/functions/company-invite-colleague/index.ts` — dono convida colega.
- `supabase/functions/company-revoke-member/index.ts` — dono revoga colega.
- `scripts/seed-catalog-from-export.ts` — importa o JSON hoje exportado do `CatalogManager` pra `catalog_machines`.

**Front (novo, em `app/src/`):**
- `lib/supabaseClient.ts` — client público (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`).
- `lib/edgeFunctions.ts` — chamador único das Edge Functions (ponto único de mock em teste).
- `auth/types.ts` — `Role`, `Profile`.
- `auth/AuthProvider.tsx`, `auth/useAuth.ts` — sessão + perfil do usuário logado.
- `auth/RouteGuards.tsx` — `RequireAuth`, `RequireRole`.
- `ui/LoginPage.tsx`
- `ui/SetPasswordPage.tsx`
- `ui/ErrorPages.tsx` — `NotFoundPage`, `ForbiddenPage`, `ServerErrorPage`, `InviteExpiredPage`.
- `ui/ErrorBoundary.tsx` — captura erro de render, loga em `client_errors`, mostra `ServerErrorPage`.
- `ui/AdminPanel.tsx` — ADMIN: cadastrar empresa/catálogo/dono.
- `ui/CompanyPanel.tsx` — dono da empresa: convidar/revogar colega.

**Front (modificado):**
- `catalog/store.ts` — troca localStorage por Supabase; funções de escrita ficam assíncronas.
- `ui/CatalogManager.tsx` — `await` nas chamadas de escrita; só monta se `role === "admin"`.
- `ui/ControlPanel.tsx` — catálogo filtrado já vem pronto do `getCatalog()` (RLS faz o filtro); sem mudança de lógica aqui, só confirmar que continua lendo normalmente.
- `App.tsx` — abas ROI/Conectividade e botão "Gerenciar máquinas" condicionados ao papel; vira o conteúdo da rota protegida `/`.
- `main.tsx` — `BrowserRouter` + `AuthProvider` + `ErrorBoundary` no topo da árvore; define as rotas.
- `vite.config.ts` — nenhuma mudança esperada (teste de `supabase/functions/_shared/*.test.ts` já cai no include padrão do vitest).

---

### Task 1: Dependências, variáveis de ambiente e projeto Supabase local

**Files:**
- Modify: `app/package.json`
- Create: `app/.env.example`
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/.env.example`

**Interfaces:**
- Produces: variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` lidas por `lib/supabaseClient.ts` (Task 3); variáveis `SUPABASE_SERVICE_ROLE_KEY`, `CAKTO_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL` lidas pelas Edge Functions (Tasks 10–13).

- [ ] **Step 1: Instalar dependências de runtime e dev**

Run: `cd app && npm install @supabase/supabase-js react-router`
Expected: ambos aparecem em `dependencies` de `app/package.json`.

- [ ] **Step 2: Inicializar o projeto Supabase na raiz do repo**

Run: `cd /home/seidor/Documents/lavanderia && supabase init`
Expected: cria `supabase/config.toml` e `supabase/functions/` (vazio).

- [ ] **Step 3: Criar `app/.env.example`**

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Criar `supabase/.env.example`**

```
SUPABASE_SERVICE_ROLE_KEY=
CAKTO_WEBHOOK_SECRET=
RESEND_API_KEY=
EMAIL_FROM=onboarding@resend.dev
APP_PUBLIC_URL=http://localhost:5173
```

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/.env.example supabase/config.toml supabase/.env.example
git commit -m "chore: add supabase + react-router deps, scaffold supabase project"
```

---

### Task 2: Esquema do banco e RLS

**Files:**
- Create: `supabase/migrations/0001_auth_schema.sql`

**Interfaces:**
- Produces: tabelas `profiles`, `companies`, `company_machines`, `catalog_machines`, `cakto_processed_events`, `admin_actions_log`, `client_errors`; função `current_profile()` usada por todas as policies e pelo Task 3.

- [ ] **Step 1: Escrever a migration**

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'empresa', 'cliente_fisico')),
  company_id uuid references companies(id),
  is_owner boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table company_machines (
  company_id uuid not null references companies(id) on delete cascade,
  catalog_machine_id text not null,
  primary key (company_id, catalog_machine_id)
);

create table catalog_machines (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table cakto_processed_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

create table admin_actions_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table client_errors (
  id bigserial primary key,
  user_id uuid,
  message text not null,
  stack text,
  created_at timestamptz not null default now()
);

-- current_profile(): único ponto de leitura de papel/empresa/ativo, usado por
-- toda policy abaixo. SECURITY DEFINER pra não recair em RLS de `profiles`
-- dentro da própria policy de `profiles`. "active = false" faz retornar
-- nenhuma linha, e toda policy abaixo nega por padrão nesse caso.
create or replace function current_profile()
returns table(role text, company_id uuid, is_owner boolean)
language sql security definer stable
as $$
  select role, company_id, is_owner
  from profiles
  where id = auth.uid() and active = true
$$;

alter table profiles enable row level security;
alter table companies enable row level security;
alter table company_machines enable row level security;
alter table catalog_machines enable row level security;
alter table cakto_processed_events enable row level security;
alter table admin_actions_log enable row level security;
alter table client_errors enable row level security;

-- profiles: cada um lê o próprio; admin lê/escreve tudo.
create policy "profiles self read" on profiles for select using (id = auth.uid());
create policy "profiles admin read" on profiles for select using ((select role from current_profile()) = 'admin');
create policy "profiles admin write" on profiles for all using ((select role from current_profile()) = 'admin');

-- companies: admin tudo; empresa lê só a própria.
create policy "companies admin all" on companies for all using ((select role from current_profile()) = 'admin');
create policy "companies own read" on companies for select using (id = (select company_id from current_profile()));

-- company_machines: admin tudo; empresa lê só a própria.
create policy "company_machines admin all" on company_machines for all using ((select role from current_profile()) = 'admin');
create policy "company_machines own read" on company_machines for select using (company_id = (select company_id from current_profile()));

-- catalog_machines: admin escreve; admin/cliente_fisico leem tudo; empresa só o que está em company_machines dela.
create policy "catalog admin write" on catalog_machines for all using ((select role from current_profile()) = 'admin');
create policy "catalog full read" on catalog_machines for select
  using ((select role from current_profile()) in ('admin', 'cliente_fisico'));
create policy "catalog empresa read" on catalog_machines for select
  using (
    (select role from current_profile()) = 'empresa'
    and id in (select catalog_machine_id from company_machines where company_id = (select company_id from current_profile()))
  );

-- cakto_processed_events / admin_actions_log: só service_role (Edge Functions) toca; nenhuma policy de usuário comum = acesso negado por padrão com RLS ligado. admin pode ler o log de auditoria.
create policy "admin_actions_log admin read" on admin_actions_log for select using ((select role from current_profile()) = 'admin');

-- client_errors: qualquer autenticado insere o próprio erro; admin lê tudo.
create policy "client_errors self insert" on client_errors for insert with check (user_id = auth.uid());
create policy "client_errors admin read" on client_errors for select using ((select role from current_profile()) = 'admin');
```

- [ ] **Step 2: Aplicar localmente e verificar**

Run: `supabase start && supabase db reset`
Expected: migration aplica sem erro; `supabase db reset` roda limpo.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_auth_schema.sql
git commit -m "feat: auth/company/catalog schema with RLS"
```

---

### Task 3: Cliente Supabase, tipos de auth e `AuthProvider`

**Files:**
- Create: `app/src/lib/supabaseClient.ts`
- Create: `app/src/auth/types.ts`
- Create: `app/src/auth/AuthProvider.tsx`
- Create: `app/src/auth/useAuth.ts`
- Test: `app/src/auth/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.onAuthStateChange`, `supabase.from("profiles").select().eq("id", ...).single()` (ambos de `@supabase/supabase-js`).
- Produces (usado pelas Tasks 4–13):
```ts
// auth/types.ts
export type Role = "admin" | "empresa" | "cliente_fisico";
export interface Profile {
  id: string;
  role: Role;
  companyId: string | null;
  isOwner: boolean;
  active: boolean;
}
```
```ts
// auth/useAuth.ts
export interface AuthState {
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
export function useAuth(): AuthState
```
```ts
// auth/AuthProvider.tsx
export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element
```

- [ ] **Step 1: Escrever o teste de `AuthProvider`/`useAuth`**

```tsx
// auth/AuthProvider.test.tsx
test("profile fica null e loading vira false quando não há sessão", async () => { /* mock supabase.auth.onAuthStateChange chamando callback com session null */ });
test("carrega o profile da tabela profiles quando há sessão", async () => { /* mock session + mock .from('profiles').select().eq().single() resolvendo {role:'empresa', company_id:'c1', is_owner:true, active:true} */ });
test("profile inativo (active=false) dispara signOut e profile fica null", async () => { /* mock active:false, assert supabase.auth.signOut foi chamado */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/auth/AuthProvider.test.tsx`
Expected: FAIL (módulos ainda não existem).

- [ ] **Step 3: Implementar `lib/supabaseClient.ts`**

Exporta `export const supabase: SupabaseClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`.

- [ ] **Step 4: Implementar `AuthProvider`/`useAuth`**

`AuthProvider` assina `supabase.auth.onAuthStateChange`; em toda mudança, se houver sessão, busca a linha de `profiles` pelo `id` do usuário e mapeia pra `Profile` (`company_id` → `companyId`, `is_owner` → `isOwner`); se `active` vier `false`, chama `supabase.auth.signOut()` e mantém `profile = null`. Expõe via Context; `useAuth()` lê o Context.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/auth/AuthProvider.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/supabaseClient.ts app/src/auth
git commit -m "feat: supabase client + AuthProvider/useAuth"
```

---

### Task 4: Roteamento e guards de rota

**Files:**
- Create: `app/src/auth/RouteGuards.tsx`
- Modify: `app/src/main.tsx`
- Modify: `app/src/App.tsx:36-131` (abas e botão "Gerenciar máquinas")
- Test: `app/src/auth/RouteGuards.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 3).
- Produces:
```ts
// auth/RouteGuards.tsx
export function RequireAuth({ children }: { children: React.ReactNode }): JSX.Element
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }): JSX.Element
```

- [ ] **Step 1: Escrever os testes de `RequireAuth`/`RequireRole`**

```tsx
test("RequireAuth redireciona pra /login quando profile é null e loading é false", () => { /* render com useAuth mockado {profile:null, loading:false}; assert navegação pra /login (ex. via MemoryRouter + screen.getByText da LoginPage de mentira) */ });
test("RequireRole mostra ForbiddenPage quando o papel do profile não está em roles", () => { /* profile.role='empresa', roles=['admin']; assert texto da ForbiddenPage */ });
test("RequireRole renderiza children quando o papel está em roles", () => { /* profile.role='admin', roles=['admin']; assert children renderizado */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/auth/RouteGuards.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar `RequireAuth`/`RequireRole`**

`RequireAuth`: enquanto `loading`, renderiza um placeholder simples; sem `profile`, `<Navigate to="/login" replace />`; senão `children`. `RequireRole`: sem o papel do `profile` em `roles`, renderiza `<ForbiddenPage />` (Task 7); senão `children`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/auth/RouteGuards.test.tsx`
Expected: PASS

- [ ] **Step 5: Ligar o roteador em `main.tsx`**

`BrowserRouter` > `AuthProvider` > `ErrorBoundary` (Task 7) > `Routes`: `/login` (Task 5), `/set-password` (Task 6), `/` → `RequireAuth` envolvendo o `App` atual, `*` → `NotFoundPage` (Task 7).

- [ ] **Step 6: Esconder por papel dentro de `App.tsx`**

Usar `const { profile } = useAuth()`. Aba "Retorno (ROI)" e "Conectividade" só renderizam o `<button>` se `profile?.role !== "cliente_fisico"`. Botão "Gerenciar máquinas" (e o `<CatalogManager>`) só se `profile?.role === "admin"`. Envolver a aba ROI/Conectividade e a seção do Painel Admin com `<RequireRole roles={[...]}>` também, não só esconder o botão (ver Review Focus).

- [ ] **Step 7: Rodar toda a suíte de testes do front**

Run: `cd app && npm test`
Expected: PASS (incluindo `App.test.tsx` já existente, ajustado se necessário pro novo contexto de auth)

- [ ] **Step 8: Commit**

```bash
git add app/src/auth app/src/main.tsx app/src/App.tsx
git commit -m "feat: routing + role-based route guards"
```

---

### Task 5: Página de login

**Files:**
- Create: `app/src/ui/LoginPage.tsx`
- Test: `app/src/ui/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword` (`lib/supabaseClient.ts`, Task 3).
- Produces: componente montado na rota `/login` (Task 4).

- [ ] **Step 1: Escrever os testes**

```tsx
test("mostra erro de credenciais inválidas sem detalhe técnico", async () => { /* mock signInWithPassword resolvendo {error:{message:'Invalid login credentials'}}; assert texto amigável tipo "Email ou senha incorretos.", nunca a message crua */ });
test("chama signInWithPassword com email e senha digitados e navega pra / em caso de sucesso", async () => { /* userEvent digita email/senha, clica Entrar; assert signInWithPassword chamado com {email, password}; assert navegação pra "/" */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/ui/LoginPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar `LoginPage`**

Form com `email`/`password`; `onSubmit` chama `supabase.auth.signInWithPassword`; erro vira mensagem genérica fixa (nunca `error.message` direto na tela); sucesso navega pra `/` (`useNavigate`).

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/ui/LoginPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/LoginPage.tsx app/src/ui/LoginPage.test.tsx
git commit -m "feat: login page"
```

---

### Task 6: Página de "defina sua senha" (convite/reset)

**Files:**
- Create: `app/src/ui/SetPasswordPage.tsx`
- Test: `app/src/ui/SetPasswordPage.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.exchangeCodeForSession`, `supabase.auth.updateUser` (Task 3's `supabase`).
- Produces: componente montado na rota `/set-password` (Task 4), que também é o `redirectTo` passado por `inviteUserByEmail`/`generateLink` nas Edge Functions (Tasks 11–13).

- [ ] **Step 1: Escrever os testes**

```tsx
test("link inválido ou expirado mostra InviteExpiredPage, não trava nem lança erro", async () => { /* mock exchangeCodeForSession resolvendo {error: {...}}; assert texto de convite inválido/expirado */ });
test("troca o code da URL por sessão e permite definir a nova senha", async () => { /* mock exchangeCodeForSession ok; userEvent digita senha nova + confirmação iguais, clica salvar; assert updateUser chamado com {password: novaSenha}; assert navegação pra / */ });
test("senha e confirmação diferentes mostra erro de validação sem chamar updateUser", async () => { /* senhas diferentes; assert updateUser NÃO chamado */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/ui/SetPasswordPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar `SetPasswordPage`**

No mount, lê `code` da query string e chama `exchangeCodeForSession`; erro → renderiza `<InviteExpiredPage />` (Task 7); sucesso → mostra form de nova senha + confirmação; valida igualdade antes de chamar `updateUser`; sucesso → `useNavigate` pra `/`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/ui/SetPasswordPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/SetPasswordPage.tsx app/src/ui/SetPasswordPage.test.tsx
git commit -m "feat: set-password page for invite/reset links"
```

---

### Task 7: Páginas de erro e `ErrorBoundary`

**Files:**
- Create: `app/src/ui/ErrorPages.tsx`
- Create: `app/src/ui/ErrorBoundary.tsx`
- Test: `app/src/ui/ErrorBoundary.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (pra pegar `user_id` ao logar em `client_errors`), `supabase.from("client_errors").insert(...)`.
- Produces:
```ts
export function NotFoundPage(): JSX.Element
export function ForbiddenPage(): JSX.Element
export function ServerErrorPage(): JSX.Element
export function InviteExpiredPage(): JSX.Element
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }>
```
Usado por: `RouteGuards` (Task 4, `ForbiddenPage`), `main.tsx` (Task 4, `NotFoundPage` na rota `*`, `ErrorBoundary` no topo), `SetPasswordPage` (Task 6, `InviteExpiredPage`).

- [ ] **Step 1: Escrever o teste de `ErrorBoundary`**

```tsx
test("captura erro de render, mostra ServerErrorPage (sem stack trace na tela) e insere em client_errors", () => {
  // componente filho que lança no render; mock supabase.from("client_errors").insert
  // assert texto da ServerErrorPage na tela, assert insert foi chamado com {message, stack, user_id}, assert stack NÃO aparece no texto renderizado
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/ui/ErrorBoundary.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar as 4 páginas de erro**

Cada uma é um componente simples (título + texto amigável em português, sem jargão técnico, sem stack/SQL) seguindo o visual já existente (`index.css`, `--primary` etc.).

- [ ] **Step 4: Implementar `ErrorBoundary`**

`componentDidCatch(error, info)`: dispara `supabase.from("client_errors").insert({ user_id, message: error.message, stack: error.stack })` (fire-and-forget, não bloqueia a renderização) e seta `hasError = true`; `render()`: com `hasError`, `<ServerErrorPage />`; senão, `children`.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/ui/ErrorBoundary.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/ui/ErrorPages.tsx app/src/ui/ErrorBoundary.tsx app/src/ui/ErrorBoundary.test.tsx
git commit -m "feat: custom error pages + error boundary logging to client_errors"
```

---

### Task 8: Catálogo migrado pro Supabase (leitura)

**Files:**
- Modify: `app/src/catalog/store.ts` (reescreve; remove `renamed`/`withNewSeed`/`SEEN_KEY`/`ADDED_TO_SEED`/`REMOVED_FROM_SEED`, que só existiam pra reconciliar drift de localStorage)
- Test: `app/src/catalog/store.test.ts` (reescreve os casos que dependiam de localStorage)

**Interfaces:**
- Consumes: `supabase.from("catalog_machines").select()` (RLS já filtra por papel/empresa — ver Task 2).
- Produces (mantém assinatura pros consumidores existentes, `ControlPanel.tsx` não muda):
```ts
export function getCatalog(): CatalogMachine[]               // snapshot síncrono do cache em memória
export function subscribeCatalog(listener: () => void): () => void
export async function refreshCatalog(): Promise<void>        // busca no Supabase, atualiza cache, notifica listeners
export function resetCatalog(): void                          // zera cache (chamado no signOut), notifica listeners
```

- [ ] **Step 1: Escrever os testes**

```ts
test("getCatalog começa vazio antes de qualquer refreshCatalog", () => { /* assert getCatalog() retorna [] */ });
test("refreshCatalog busca catalog_machines, popula o cache e notifica os listeners", async () => {
  // mock supabase.from('catalog_machines').select() resolvendo { data: [{id:'m1', data: {...CatalogMachine}}], error: null }
  // assert getCatalog() retorna [CatalogMachine de m1] depois do await, assert listener foi chamado
});
test("resetCatalog esvazia o cache e notifica os listeners", () => { /* popula via refreshCatalog, chama resetCatalog, assert getCatalog() === [] */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/catalog/store.test.ts`
Expected: FAIL

- [ ] **Step 3: Reescrever `catalog/store.ts`**

Cache em memória (`let cached: CatalogMachine[] = []`) + `Set<Listener>` (lógica de `subscribeCatalog`/`emitChange` já existente, mantém). `refreshCatalog` faz `select("id, data")`, mapeia cada linha pra `row.data as CatalogMachine` (ignorando a coluna `id` solta, já que `data` já contém `id`), atualiza `cached`, chama `emitChange()`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/catalog/store.test.ts`
Expected: PASS

- [ ] **Step 5: Chamar `refreshCatalog`/`resetCatalog` a partir do `AuthProvider` (Task 3)**

Em `AuthProvider`, depois de carregar um `profile` válido, `await refreshCatalog()`; no `signOut`/sessão nula, `resetCatalog()`. (Edição pequena em `auth/AuthProvider.tsx`, sem novo teste — já cobertos pelos testes da Task 3 mockando o módulo de catálogo.)

- [ ] **Step 6: Commit**

```bash
git add app/src/catalog/store.ts app/src/catalog/store.test.ts app/src/auth/AuthProvider.tsx
git commit -m "feat: catalog reads move from localStorage to supabase (RLS-filtered)"
```

---

### Task 9: `CatalogManager` — escrita só para admin

**Files:**
- Modify: `app/src/catalog/store.ts` (acrescenta as funções de escrita)
- Modify: `app/src/ui/CatalogManager.tsx` (chamadas assíncronas; só monta sob `RequireRole roles={["admin"]}`, já feito na Task 4)
- Test: `app/src/catalog/store.test.ts` (casos novos)
- Test: `app/src/ui/CatalogManager.test.tsx` (ajusta os casos existentes pra `await`)

**Interfaces:**
- Produces:
```ts
export async function addMachine(machine: CatalogMachine): Promise<void>
export async function updateMachine(id: string, patch: Partial<CatalogMachine>): Promise<void>
export async function deleteMachine(id: string): Promise<void>
export async function importCatalogJSON(json: string): Promise<void>   // mesma validação de isValidMachine já existente
export function exportCatalogJSON(): string                             // sem mudança, lê o cache em memória
```

- [ ] **Step 1: Escrever os testes novos em `store.test.ts`**

```ts
test("addMachine faz upsert em catalog_machines e chama refreshCatalog", async () => { /* mock .from('catalog_machines').upsert(); assert chamado com {id: machine.id, data: machine}; assert cache atualizado depois */ });
test("deleteMachine remove a linha por id e chama refreshCatalog", async () => { /* mock .delete().eq('id', id) */ });
test("importCatalogJSON com item inválido lança erro e NÃO chama upsert", async () => { /* reaproveita o JSON inválido do teste já existente */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/catalog/store.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar as funções de escrita**

Cada uma chama o `supabase.from("catalog_machines")` correspondente (`upsert`/`delete`) e, em caso de sucesso, `await refreshCatalog()`. `isValidMachine` (validação já existente) continua rodando antes de qualquer escrita em `importCatalogJSON`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/catalog/store.test.ts`
Expected: PASS

- [ ] **Step 5: Ajustar `CatalogManager.tsx` pros novos retornos assíncronos**

Cada handler (`onClick`/`onSubmit`) passa a `await` a chamada e trata erro (mensagem amigável, sem detalhe técnico, reaproveitando o padrão da Task 5).

- [ ] **Step 6: Rodar os testes de `CatalogManager`**

Run: `cd app && npx vitest run src/ui/CatalogManager.test.tsx`
Expected: PASS (ajustados pra `await`/`findBy*` em vez de `getBy*` onde a ação ficou assíncrona)

- [ ] **Step 7: Escrever `scripts/seed-catalog-from-export.ts`**

Script Node (`tsx scripts/seed-catalog-from-export.ts <caminho-do-json-exportado>`): lê o arquivo (o JSON que o botão "Exportar" do `CatalogManager` já gera hoje), valida cada item com a mesma `isValidMachine` (reexportada de `catalog/store.ts` pra esse fim), e faz upsert de cada item em `catalog_machines` usando um client `@supabase/supabase-js` criado com `SUPABASE_SERVICE_ROLE_KEY` (lido de `process.env`, nunca hardcoded) — roda fora do navegador, então pode usar a chave service-role sem violar a restrição global.

- [ ] **Step 8: Commit**

```bash
git add app/src/catalog/store.ts app/src/ui/CatalogManager.tsx app/src/catalog/store.test.ts app/src/ui/CatalogManager.test.tsx scripts/seed-catalog-from-export.ts
git commit -m "feat: catalog writes go through supabase, admin-only; add one-time seed script"
```

---

### Task 10: Helpers compartilhados das Edge Functions

**Files:**
- Create: `supabase/functions/_shared/caktoSignature.ts`
- Create: `supabase/functions/_shared/supabaseAdmin.ts`
- Create: `supabase/functions/_shared/resend.ts`
- Create: `supabase/functions/_shared/auditLog.ts`
- Test: `supabase/functions/_shared/caktoSignature.test.ts`

**Interfaces:**
- Produces (usado pelas Tasks 11–13):
```ts
export async function verifyCaktoSignature(params: {
  secret: string;
  signatureHeader: string;   // valor de X-Cakto-Signature, formato "v1=<hex>"
  timestampHeader: string;   // valor de X-Cakto-Timestamp, unix seconds em string
  rawBody: string;
  now?: number;              // unix seconds; default Date.now()/1000
  maxSkewSeconds?: number;   // default 300
}): Promise<boolean>
```
```ts
export function createSupabaseAdminClient(): SupabaseClient   // lê SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY de Deno.env
export async function sendBrandedEmail(params: { to: string; heading: string; actionUrl: string; actionLabel: string }): Promise<void>   // RESEND_API_KEY/EMAIL_FROM de Deno.env, template com --primary #0b3d59
export async function logAdminAction(params: { admin: SupabaseClient; actorId: string | null; action: string; details?: Record<string, unknown> }): Promise<void>
```

- [ ] **Step 1: Escrever os testes de `verifyCaktoSignature`**

```ts
test("retorna true pra uma assinatura HMAC-SHA256 correta e timestamp recente", async () => { /* gera a assinatura esperada manualmente com Web Crypto no próprio teste, usando o mesmo secret, compara */ });
test("retorna false quando a assinatura não bate", async () => { /* signatureHeader = "v1=0000...(„hex errado)" */ });
test("retorna false quando o timestamp está fora da janela de maxSkewSeconds", async () => { /* now - timestamp = 301 */ });
test("retorna false quando signatureHeader não está no formato v1=<hex>", async () => { /* signatureHeader = "abc" */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run ../supabase/functions/_shared/caktoSignature.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `verifyCaktoSignature`**

Usa `crypto.subtle.importKey`/`sign` (Web Crypto, disponível em Deno e Node) sobre `` `${timestampHeader}.${rawBody}` ``, hex-encode o resultado, extrai o hex depois de `"v1="` do header (retorna `false` se o formato não bater), compara em tempo constante (não usar `===` direto nas strings de hex — comparar byte a byte com XOR acumulado ou usar `crypto.subtle` novamente via `timingSafeEqual` se disponível no runtime), e só então checa `Math.abs(now - Number(timestampHeader)) <= maxSkewSeconds`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run ../supabase/functions/_shared/caktoSignature.test.ts`
Expected: PASS

- [ ] **Step 5: Implementar `supabaseAdmin.ts`, `resend.ts`, `auditLog.ts`**

Sem teste automatizado (dependem de rede/Deno.env); corpo direto conforme as assinaturas acima.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared
git commit -m "feat: shared edge function helpers (cakto signature, resend, audit log)"
```

---

### Task 11: Edge Function `cakto-webhook`

**Files:**
- Create: `supabase/functions/cakto-webhook/index.ts`

**Interfaces:**
- Consumes: `verifyCaktoSignature`, `createSupabaseAdminClient`, `sendBrandedEmail`, `logAdminAction` (Task 10).
- Produces: endpoint público `POST /functions/v1/cakto-webhook`.

- [ ] **Step 1: Implementar o handler**

1. Lê o corpo como texto puro (`await req.text()`) antes de qualquer parse.
2. `verifyCaktoSignature({ secret: Deno.env.get("CAKTO_WEBHOOK_SECRET")!, signatureHeader: req.headers.get("X-Cakto-Signature") ?? "", timestampHeader: req.headers.get("X-Cakto-Timestamp") ?? "", rawBody })` — se `false`, `return new Response(null, { status: 401 })` sem tocar no banco.
3. `JSON.parse(rawBody)`; se `event !== "purchase_approved"`, `return new Response(null, { status: 200 })` (ignora, não é erro).
4. Com o client admin, tenta inserir `{ event_id: data.id }` em `cakto_processed_events`; erro de chave duplicada (unique violation) → já processado, `return new Response(null, { status: 200 })` sem reenviar email.
5. `admin.auth.admin.inviteUserByEmail(data.customer.email, { redirectTo: `${Deno.env.get("APP_PUBLIC_URL")}/set-password` })`.
6. Insere em `profiles` `{ id: <id do usuário criado>, role: "cliente_fisico", company_id: null, is_owner: false, active: true }`.
7. `logAdminAction({ admin, actorId: null, action: "cakto_cliente_fisico_created", details: { email: data.customer.email, orderId: data.id } })`.
8. `return new Response(null, { status: 200 })`.

- [ ] **Step 2: Verificar manualmente com o endpoint de teste da Cakto**

Run: configurar o webhook no painel da Cakto apontando pra URL da function (ou usar o endpoint "Evento de Teste" da API da Cakto, documentado em `docs.cakto.com.br/api-reference/webhooks/test-webhook`), disparar um `purchase_approved` de teste.
Expected: resposta 2xx; linha nova em `profiles` (`role = cliente_fisico`) e em `cakto_processed_events`; email de convite recebido. Disparar o mesmo evento de novo e confirmar que NÃO cria um segundo usuário.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/cakto-webhook
git commit -m "feat: cakto purchase_approved webhook creates cliente_fisico account"
```

---

### Task 12: Edge Function `admin-create-company` + Painel Admin

**Files:**
- Create: `supabase/functions/admin-create-company/index.ts`
- Create: `app/src/lib/edgeFunctions.ts`
- Create: `app/src/ui/AdminPanel.tsx`
- Test: `app/src/ui/AdminPanel.test.tsx`

**Interfaces:**
- Consumes: `getCatalog()` (Task 8, pra listar as máquinas disponíveis no formulário).
- Produces:
```ts
// lib/edgeFunctions.ts
export async function invokeEdgeFunction<TResponse>(name: string, body: unknown): Promise<TResponse>
```
```ts
// admin-create-company Edge Function, chamada via invokeEdgeFunction("admin-create-company", body)
interface CreateCompanyRequest { name: string; machineIds: string[]; ownerEmail: string }
interface CreateCompanyResponse { companyId: string }
```

- [ ] **Step 1: Escrever os testes de `AdminPanel`**

```tsx
test("envia nome, máquinas marcadas e email do dono pra admin-create-company", async () => {
  // mock invokeEdgeFunction resolvendo {companyId: "c1"}
  // userEvent preenche nome, marca 2 checkboxes de máquina, preenche email, clica "Cadastrar empresa"
  // assert invokeEdgeFunction chamado com ("admin-create-company", {name, machineIds: [...], ownerEmail})
});
test("mostra mensagem de sucesso com o nome da empresa depois de criar", async () => { /* ... */ });
test("mostra erro amigável quando invokeEdgeFunction rejeita", async () => { /* mock rejeita; assert mensagem sem detalhe técnico */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/ui/AdminPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar `lib/edgeFunctions.ts`**

`invokeEdgeFunction` chama `supabase.functions.invoke(name, { body })`; se `error`, lança um `Error` com mensagem amigável fixa; senão retorna `data as TResponse`.

- [ ] **Step 4: Implementar `AdminPanel`**

Form com nome da empresa, lista de checkboxes (uma por item de `getCatalog()`), email do dono; `onSubmit` chama `invokeEdgeFunction("admin-create-company", { name, machineIds, ownerEmail })`; sucesso mostra confirmação; erro mostra mensagem amigável.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/ui/AdminPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Implementar a Edge Function `admin-create-company`**

Com o client admin: confirma que quem chama é `admin` (lê `profiles` pelo `auth.uid()` do JWT recebido — Edge Functions recebem o JWT do chamador em `Authorization`); insere em `companies`; insere em `company_machines` uma linha por `machineId`; `inviteUserByEmail(ownerEmail, { redirectTo: .../set-password })`; insere `profiles` do dono (`role: "empresa"`, `company_id`, `is_owner: true`, `active: true`); `logAdminAction(...)`; retorna `{ companyId }`.

- [ ] **Step 7: Montar `AdminPanel` na rota, atrás de `RequireRole roles={["admin"]}` (Task 4)**

Editar `App.tsx`: novo botão/aba "Painel Admin" visível só pra `profile?.role === "admin"`, renderizando `<AdminPanel />` envolvido por `RequireRole`.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/admin-create-company app/src/lib/edgeFunctions.ts app/src/ui/AdminPanel.tsx app/src/ui/AdminPanel.test.tsx app/src/App.tsx
git commit -m "feat: admin panel to create companies with scoped catalog + owner invite"
```

---

### Task 13: Edge Functions `company-invite-colleague`/`company-revoke-member` + Painel da Empresa

**Files:**
- Create: `supabase/functions/company-invite-colleague/index.ts`
- Create: `supabase/functions/company-revoke-member/index.ts`
- Create: `app/src/ui/CompanyPanel.tsx`
- Test: `app/src/ui/CompanyPanel.test.tsx`

**Interfaces:**
- Consumes: `invokeEdgeFunction` (Task 12), `useAuth()` (Task 3, pra saber `isOwner`).
- Produces:
```ts
interface InviteColleagueRequest { email: string }
interface RevokeMemberRequest { userId: string }
```

- [ ] **Step 1: Escrever os testes de `CompanyPanel`**

```tsx
test("dono vê o formulário de convite e a lista de colegas; convite chama company-invite-colleague", async () => { /* profile.isOwner=true; preenche email, clica convidar; assert invokeEdgeFunction("company-invite-colleague", {email}) */ });
test("colega (não-dono) não vê formulário de convite nem botão de revogar", () => { /* profile.isOwner=false; assert ausência dos controles */ });
test("revogar chama company-revoke-member com o userId do colega", async () => { /* clica revogar no colega X; assert invokeEdgeFunction("company-revoke-member", {userId: X}) */ });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run src/ui/CompanyPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar `CompanyPanel`**

Lista os membros da própria empresa (`supabase.from("profiles").select().eq("company_id", profile.companyId)`); com `profile.isOwner`, mostra form de convite (chama `invokeEdgeFunction("company-invite-colleague", { email })`) e botão "Revogar" por colega não-dono (chama `invokeEdgeFunction("company-revoke-member", { userId })`); sem `isOwner`, só lista, sem controles.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/ui/CompanyPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Implementar as duas Edge Functions**

`company-invite-colleague`: confirma que quem chama é `empresa` com `is_owner = true` (via `profiles` pelo JWT do chamador); `inviteUserByEmail(email, { redirectTo: .../set-password })`; insere `profiles` (`role: "empresa"`, mesmo `company_id` do chamador, `is_owner: false`, `active: true`); `logAdminAction`.
`company-revoke-member`: mesma confirmação de dono; `update profiles set active = false where id = userId and company_id = <company_id do chamador>` (nunca revoga fora da própria empresa); `logAdminAction`.

- [ ] **Step 6: Montar `CompanyPanel` em `App.tsx`, visível pra qualquer `role === "empresa"`**

- [ ] **Step 7: Verificar manualmente que revogar corta o acesso na hora (não só escondendo botão)**

Run: revogar um colega de teste via `CompanyPanel`; com a sessão desse colega ainda aberta em outra aba/navegador, rodar `select * from catalog_machines` (ou qualquer leitura RLS) autenticado como ele.
Expected: nenhuma linha retornada (RLS via `current_profile()` nega porque `active = false`) mesmo sem o navegador dele ter recarregado ou deslogado.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/company-invite-colleague supabase/functions/company-revoke-member app/src/ui/CompanyPanel.tsx app/src/ui/CompanyPanel.test.tsx app/src/App.tsx
git commit -m "feat: company owner can invite/revoke colleagues"
```

---

## Depois do plano (fora do escopo das tasks, documentado no spec)

- Comprar o domínio (Hostinger) e trocar `APP_PUBLIC_URL`/`EMAIL_FROM` dos placeholders pro domínio real; verificar o domínio no Resend.
- Rodar `scripts/seed-catalog-from-export.ts` com o JSON exportado do `CatalogManager` de hoje (botão de exportar já existente), pra popular `catalog_machines` com as specs já ajustadas, antes de considerar a Task 8 "em produção".
