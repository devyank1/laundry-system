# Cadastro completo da equipe e sessão única — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda pessoa de empresa (dono e vendedores) só usa o app depois de preencher nome completo, CPF, telefone, cargo e foto (CPF/telefone únicos entre contas ativas), e cada conta só tem um aparelho logado por vez — o login novo derruba o anterior no servidor, na hora.

**Architecture:** Postgres faz a regra de verdade: `current_profile()` (base de toda RLS) passa a exigir (a) que o `session_id` do JWT seja o da sessão ativa da conta em `user_sessions` e (b) cadastro completo quando `role = 'empresa'`. O cadastro e a edição passam por RPCs `security definer` que validam CPF/telefone; um trigger audita mudanças de dados cadastrais. O front reivindica a sessão só em login de verdade (senha ou link), checa periodicamente se ainda é a sessão ativa e mostra o aviso de derrubada; uma tela de cadastro bloqueia a empresa até completar.

**Tech Stack:** React 19 + Vite + TypeScript, `@supabase/supabase-js`, react-router, Supabase (Postgres/RLS, Auth, Storage, Edge Functions Deno), vitest + Testing Library, pgTAP (`npx supabase@3.1.0 test db`).

**Spec:** `docs/superpowers/specs/2026-11-15-equipe-sessao-unica-design.md`

## Global Constraints

- Nenhuma chave service_role no navegador; regras de acesso sempre no servidor (RLS/RPC/Edge Function), a UI só reflete.
- Campos obrigatórios do cadastro: nome completo, CPF, telefone, cargo, foto. Só para `role = 'empresa'` (dono e vendedores). `cliente_fisico` e `admin` não passam pelo cadastro.
- CPF validado por dígitos verificadores; CPF e telefone únicos **entre perfis ativos** (`active = true`); revogar libera os dois.
- Telefone: celular/fixo BR com DDD, guardado só com dígitos (10 ou 11 dígitos).
- Sessão única para todos os papéis. Mensagem exata no aparelho derrubado: `Seu acesso neste aparelho foi encerrado porque a conta entrou em outro aparelho.`
- Sem alerta, sem contagem de derrubadas, sem limite de vagas. Logins e derrubadas só ficam registrados (histórico, sem tela).
- Vendedor pode editar telefone, cargo e foto; nome completo e CPF só o admin corrige; toda alteração desses campos vai para `admin_actions_log`.
- Quem vê: admin vê tudo; dono vê nome, cargo, CPF, telefone e foto da própria equipe; vendedor vê os próprios dados e só nome + cargo dos colegas; nada de outra empresa.
- Mensagens de erro na tela nunca identificam outra pessoa (ex.: "Este CPF já está em uso.", nunca de quem).
- Foto: bucket privado `profile-photos`, caminho `<user_id>/photo`, até 2 MB, só `image/jpeg`, `image/png`, `image/webp`.
- Texto LGPD no formulário: `Usamos estes dados só para identificar quem usa o configurador e controlar o acesso da sua empresa.`
- Migrations novas a partir de `0005_`; aplicar na nuvem só ao final (Task 8), com `npx supabase@3.1.0`.

## Review Focus

- Recarregar a página no aparelho antigo **não** pode reivindicar a sessão de volta (só login com senha/link reivindica) — teste em Task 3.
- Aparelho derrubado com access token ainda dentro da validade não lê catálogo nem chama Edge Function — pgTAP em Task 2, teste de `getCaller` em Task 3.
- CPF digitado com máscara (`123.456.789-09`) e sem máscara é o mesmo CPF para validação e unicidade — testes em Task 1 (SQL) e Task 4 (TS).
- Duas pessoas tentando o mesmo CPF ao mesmo tempo: a segunda recebe "Este CPF já está em uso." (índice único, não checagem prévia) — pgTAP em Task 1, teste de mensagem em Task 4.
- Dono de empresa já existente sem cadastro (ex.: Lavanderia Gustavo) cai na tela de cadastro ao entrar, não em tela em branco/"sem permissão" — teste em Task 4.

---

## File Structure

**Banco (novo):**
- `supabase/migrations/0005_team_registration.sql` — colunas de cadastro, `is_valid_cpf()`, índices únicos parciais, RPCs `complete_registration` / `update_my_contact` / `company_team`, trigger de auditoria, troca da policy "profiles same company read".
- `supabase/migrations/0006_profile_photos.sql` — bucket `profile-photos` + policies de `storage.objects`.
- `supabase/migrations/0007_single_session.sql` — `user_sessions`, `login_events`, `claim_session()`, `session_is_current()`, nova `current_profile()`.
- `supabase/tests/team.test.sql`, `supabase/tests/session.test.sql` — pgTAP. `supabase/tests/rls.test.sql` ajustado (claims com `session_id`).

**Edge Functions (modificado):**
- `supabase/functions/_shared/jwt.ts` (novo, puro) + `jwt.test.ts` — `jwtSessionId(token)`.
- `supabase/functions/_shared/http.ts` — `getCaller` exige sessão ativa.
- `supabase/functions/company-revoke-member/{handler,index}.ts` — convite nunca aceito é removido (apaga usuário) em vez de banido.

**Front (novo):**
- `app/src/lib/cpf.ts` (+ test) — `normalizeCpf`, `isValidCpf`, `formatCpf`; `normalizePhone`, `isValidPhone`.
- `app/src/auth/session.ts` (+ test) — `claimSession()`, `isCurrentSession()`, `SESSION_REPLACED_MESSAGE`.
- `app/src/auth/useSessionGuard.ts` (+ test) — checagem periódica/foco que derruba o aparelho antigo.
- `app/src/profile/photos.ts` — upload e URL assinada da foto.
- `app/src/profile/registration.ts` — chamadas `complete_registration` / `update_my_contact` com erros amigáveis.
- `app/src/ui/CompleteRegistrationPage.tsx` (+ test).
- `app/src/ui/MyDataPanel.tsx` (+ test) — "Meus dados".
- `app/src/ui/AdminTeamsPanel.tsx` (+ test) — empresas e equipes, correção de nome/CPF.

**Front (modificado):** `auth/types.ts`, `auth/AuthProvider.tsx`, `auth/RouteGuards.tsx` (novo `RequireRegistration`), `main.tsx`, `ui/LoginPage.tsx`, `ui/SetPasswordPage.tsx`, `company/members.ts`, `ui/CompanyPanel.tsx`, `App.tsx`.

---

### Task 1: Cadastro no banco — colunas, CPF, unicidade, RPCs e auditoria

**Files:**
- Create: `supabase/migrations/0005_team_registration.sql`
- Create: `supabase/tests/team.test.sql`

**Interfaces:**
- Produces (SQL):
  - colunas em `profiles`: `full_name text`, `cpf text` (11 dígitos), `phone text` (10–11 dígitos), `job_title text`, `photo_path text`, `registration_completed_at timestamptz`.
  - `public.is_valid_cpf(p text) returns boolean` (aceita com ou sem máscara).
  - índices únicos parciais `profiles_cpf_active_uniq on profiles(cpf) where active and cpf is not null`, idem `profiles_phone_active_uniq`.
  - `public.complete_registration(p_full_name text, p_cpf text, p_phone text, p_job_title text, p_photo_path text) returns void` — só o próprio usuário, `role = 'empresa'`, ativo; normaliza CPF/telefone para dígitos; erros com `raise exception using errcode`: `'22023'` + mensagem `invalid_cpf` / `invalid_phone` / `missing_field`; violação de unicidade sobe como `23505` com constraint name (front mapeia). Define `registration_completed_at = now()`.
  - `public.update_my_contact(p_phone text, p_job_title text, p_photo_path text) returns void` — só depois do cadastro completo; nunca mexe em nome/CPF.
  - `public.company_team() returns table(id uuid, full_name text, job_title text, is_owner boolean, active boolean, registered boolean, email text, cpf text, phone text, photo_path text)` — da empresa do chamador; para quem não é dono, `email/cpf/phone/photo_path` vêm `null` exceto na própria linha.
  - trigger `profiles_registration_audit` (after update) grava em `admin_actions_log` `action = 'profile_data_changed'`, `actor_id = auth.uid()`, `details = {id, fields: [nomes dos campos alterados]}` (sem valores de CPF/telefone).
  - policy `"profiles same company read"` é removida (equipe passa a vir só por `company_team()`).

- [ ] **Step 1: Escrever `supabase/tests/team.test.sql`** (usuários em `@pgtap.local`, `begin … rollback`), com:
  - `is_valid_cpf('529.982.247-25')` true; `is_valid_cpf('52998224725')` true; `is_valid_cpf('111.111.111-11')` false; `is_valid_cpf('52998224726')` false.
  - como vendedor (claims do vendedor): `complete_registration('Ana Lima','529.982.247-25','(11) 98765-4321','Vendedora','<id>/photo')` lives_ok; perfil fica com `cpf = '52998224725'`, `phone = '11987654321'`, `registration_completed_at is not null`.
  - segundo vendedor ativo com o mesmo CPF → `throws_ok(..., '23505')`.
  - depois de `update profiles set active=false` no primeiro (como superuser), o segundo consegue o mesmo CPF (lives_ok).
  - `complete_registration` com CPF inválido → `throws_ok(..., '22023', 'invalid_cpf')`; com telefone `'123'` → `'invalid_phone'`; nome vazio → `'missing_field'`.
  - `cliente_fisico` chamando `complete_registration` → throws `'42501'`.
  - vendedor chama `update_my_contact('(21) 3456-7890','Gerente','<id>/photo')` → telefone `'2134567890'`; nome/CPF inalterados; `admin_actions_log` tem `profile_data_changed` com `details->'fields' ? 'phone'` e sem o número no `details::text`.
  - `company_team()` como vendedor não-dono: linha do colega tem `cpf is null` e `photo_path is null`; como dono: `cpf` do vendedor preenchido. Vendedor de outra empresa não aparece.
  - vendedor não lê perfil do colega direto: `select count(*) from profiles` como vendedor = 1.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx supabase@3.1.0 db reset && npx supabase@3.1.0 test db`
  Expected: FAIL em `team.test.sql` (funções/colunas não existem).

- [ ] **Step 3: Escrever `0005_team_registration.sql`** conforme o bloco Interfaces. CPF: algoritmo padrão dos dois dígitos verificadores sobre os 11 dígitos, recusando todos iguais. RPCs `security definer set search_path = ''`, `revoke … from public, anon` e `grant execute … to authenticated`.

- [ ] **Step 4: Rodar e ver passar**
  Run: `npx supabase@3.1.0 db reset && npx supabase@3.1.0 test db`
  Expected: PASS em `team.test.sql` e `rls.test.sql` (o teste antigo "empresa vê só perfis da própria empresa" passa a esperar 1 — ajustar para refletir a remoção da policy).

- [ ] **Step 5: Commit**
  `git add supabase/migrations/0005_team_registration.sql supabase/tests && git commit -m "feat(db): team registration fields, CPF validation, unique active CPF/phone, team RPCs"`

---

### Task 2: Sessão única no banco + cadastro exigido pela RLS

**Files:**
- Create: `supabase/migrations/0007_single_session.sql`
- Create: `supabase/tests/session.test.sql`
- Modify: `supabase/tests/rls.test.sql`, `supabase/tests/team.test.sql` (claims passam a incluir `session_id` + linha em `user_sessions`)

**Interfaces:**
- Produces (SQL):
  - `user_sessions(user_id uuid pk references auth.users on delete cascade, session_id uuid not null, updated_at timestamptz)` — RLS ligado, sem policy (só via funções).
  - `login_events(id bigserial, user_id uuid, session_id uuid, replaced_session_id uuid, ip text, user_agent text, created_at timestamptz)` — RLS ligado; policy só `admin` select.
  - `public.claim_session(p_user_agent text) returns void` — usa `auth.uid()` e `(auth.jwt()->>'session_id')::uuid`; upsert em `user_sessions`; insere `login_events` com `replaced_session_id` = sessão anterior se diferente, `ip` = primeiro valor de `x-forwarded-for` em `current_setting('request.headers', true)`.
  - `public.session_is_current() returns boolean`.
  - `public.current_profile()` recriada: além de `active`, exige `exists(user_sessions where user_id = auth.uid() and session_id = (auth.jwt()->>'session_id')::uuid)` e `(role <> 'empresa' or registration_completed_at is not null)`.
  - `complete_registration` e `update_my_contact` (Task 1) passam a exigir `session_is_current()` (errcode `'42501'`).

- [ ] **Step 1: Escrever `supabase/tests/session.test.sql`:**
  - cliente com claims `{sub, session_id: S1}` chama `claim_session('ua1')`; lê catálogo (count > 0).
  - mesmo usuário com claims `session_id: S2` chama `claim_session('ua2')`; `login_events` tem linha com `replaced_session_id = S1`.
  - com claims `S1` de novo: `session_is_current()` = false e `select count(*) from catalog_machines` = 0 (token antigo não lê).
  - usuário sem linha em `user_sessions` lê 0 linhas do catálogo.
  - vendedor sem cadastro completo, com sessão válida: catálogo = 0; depois de `complete_registration`: catálogo > 0.
  - `cliente_fisico` sem cadastro, sessão válida: catálogo > 0.
  - `authenticated` não lê `login_events` nem `user_sessions` direto (count 0 / 42501); admin lê `login_events`.
  - `complete_registration` com claims de sessão antiga → `throws_ok(..., '42501')`.

- [ ] **Step 2: Rodar e ver falhar** — Run: `npx supabase@3.1.0 db reset && npx supabase@3.1.0 test db` — Expected: FAIL em `session.test.sql`.

- [ ] **Step 3: Escrever `0007_single_session.sql`** conforme Interfaces; ajustar `rls.test.sql`/`team.test.sql` com um helper no início de cada arquivo que insere `user_sessions` para os usuários de teste e usa `session_id` nos claims.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando — Expected: PASS nos três arquivos.

- [ ] **Step 5: Commit** — `git commit -m "feat(db): single active session per account enforced in RLS; registration required for empresa"`

---

### Task 3: Sessão única no front e nas Edge Functions

**Files:**
- Create: `app/src/auth/session.ts`, `app/src/auth/session.test.ts`
- Create: `app/src/auth/useSessionGuard.ts`, `app/src/auth/useSessionGuard.test.tsx`
- Create: `supabase/functions/_shared/jwt.ts`, `supabase/functions/_shared/jwt.test.ts`
- Modify: `supabase/functions/_shared/http.ts` (`getCaller`)
- Modify: `app/src/ui/LoginPage.tsx` (+ test), `app/src/ui/SetPasswordPage.tsx` (+ test), `app/src/auth/AuthProvider.tsx` (+ test)

**Interfaces:**
- Produces:
```ts
// auth/session.ts
export const SESSION_REPLACED_MESSAGE = "Seu acesso neste aparelho foi encerrado porque a conta entrou em outro aparelho.";
export async function claimSession(): Promise<void>;      // rpc("claim_session", { p_user_agent: navigator.userAgent }) e depois auth.signOut({ scope: "others" })
export async function isCurrentSession(): Promise<boolean>; // rpc("session_is_current"); erro de rede => true (não derruba por instabilidade)
// auth/useSessionGuard.ts
export function useSessionGuard(active: boolean, intervalMs?: number /* default 20000 */): void;
// ao detectar false: auth.signOut({ scope: "local" }) e navigate("/login?motivo=outro-aparelho", { replace: true })
```
```ts
// supabase/functions/_shared/jwt.ts
export function jwtSessionId(token: string): string | null; // decodifica o payload base64url, sem verificar assinatura (getUser já verifica)
```
- `getCaller` retorna `null` quando o `session_id` do token não é o de `user_sessions` do usuário.

- [ ] **Step 1: Testes que falham**
  - `session.test.ts`: `claimSession` chama `rpc("claim_session", { p_user_agent: expect.any(String) })` **antes** de `signOut({ scope: "others" })`; `isCurrentSession` retorna false quando rpc devolve `{ data: false }` e true quando rpc devolve erro.
  - `useSessionGuard.test.tsx` (fake timers): com `isCurrentSession` → false após 20 s, chama `signOut({ scope: "local" })` e navega para `/login?motivo=outro-aparelho`; com `active=false` nunca chama; evento `focus` na janela dispara checagem imediata.
  - `LoginPage.test.tsx`: sucesso no login chama `claimSession` antes de navegar; com `?motivo=outro-aparelho` na URL mostra `SESSION_REPLACED_MESSAGE` em `role="status"`.
  - `SetPasswordPage.test.tsx`: `verifyOtp` ok → `claimSession` chamado antes de mostrar o formulário.
  - `AuthProvider.test.tsx`: evento `INITIAL_SESSION` com sessão **não** chama `claimSession` (reload não reivindica).
  - `jwt.test.ts`: token `header.<base64url de {"session_id":"abc"}>.sig` → `"abc"`; lixo → `null`.
- [ ] **Step 2: Rodar e ver falhar** — Run: `cd app && npx vitest run src/auth src/ui/LoginPage.test.tsx src/ui/SetPasswordPage.test.tsx ../supabase/functions/_shared/jwt.test.ts` — Expected: FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar** `session.ts`, `useSessionGuard.ts`, `jwt.ts`; chamar `claimSession()` em LoginPage (após `signInWithPassword` ok) e SetPasswordPage (após `verifyOtp` ok); ligar `useSessionGuard(Boolean(profile))` dentro de `RequireAuth` (tem acesso ao router); `getCaller` compara `jwtSessionId(token)` com `user_sessions.session_id` via client admin.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando + `cd app && npm test` — Expected: PASS, suíte inteira verde.
- [ ] **Step 5: Commit** — `git commit -m "feat: claim session on login, kick old device with notice, edge functions require current session"`

---

### Task 4: Tela "Complete seu cadastro" e bloqueio no front

**Files:**
- Create: `app/src/lib/cpf.ts`, `app/src/lib/cpf.test.ts`
- Create: `app/src/profile/photos.ts`, `app/src/profile/registration.ts`, `app/src/profile/registration.test.ts`
- Create: `app/src/ui/CompleteRegistrationPage.tsx`, `app/src/ui/CompleteRegistrationPage.test.tsx`
- Create: `supabase/migrations/0006_profile_photos.sql` (+ casos em `supabase/tests/team.test.sql`)
- Modify: `app/src/auth/types.ts`, `app/src/auth/AuthProvider.tsx`, `app/src/auth/RouteGuards.tsx`, `app/src/main.tsx`

**Interfaces:**
- Consumes: `complete_registration` (Task 1), sessão (Task 3).
- Produces:
```ts
// lib/cpf.ts
export function normalizeCpf(v: string): string;          // só dígitos
export function isValidCpf(v: string): boolean;
export function formatCpf(v: string): string;             // 000.000.000-00
export function normalizePhone(v: string): string;
export function isValidPhone(v: string): boolean;         // 10 ou 11 dígitos, DDD 11–99
// profile/photos.ts
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export async function uploadMyPhoto(userId: string, file: File): Promise<string>; // retorna "<userId>/photo"; recusa tipo/tamanho com Error amigável; upsert
export async function photoUrl(path: string): Promise<string | null>;            // signed URL 1 h
// profile/registration.ts
export interface RegistrationInput { fullName: string; cpf: string; phone: string; jobTitle: string; photoPath: string }
export async function completeRegistration(input: RegistrationInput): Promise<void>; // mapeia 23505 cpf -> "Este CPF já está em uso.", 23505 phone -> "Este telefone já está em uso.", invalid_cpf -> "CPF inválido.", invalid_phone -> "Telefone inválido. Use DDD + número."
// auth/types.ts — Profile ganha: fullName: string | null; registrationComplete: boolean
// auth/RouteGuards.tsx
export function RequireRegistration({ children }: { children: React.ReactNode }): JSX.Element; // role empresa sem cadastro => <CompleteRegistrationPage />
```
  - `AuthProvider` expõe também `refreshProfile(): Promise<void>` em `AuthState` (a tela chama após salvar).
  - Bucket `profile-photos` (privado, 2 MB, jpeg/png/webp). Policies em `storage.objects`: usuário insere/atualiza/lê `name like auth.uid() || '/%'`; leitura também para admin e para dono cuja `company_id` = a do dono da pasta.

- [ ] **Step 1: Testes que falham**
  - `cpf.test.ts`: `isValidCpf("529.982.247-25")` true, `"52998224725"` true, `"111.111.111-11"` false, `"52998224726"` false, `"123"` false; `formatCpf("52998224725") === "529.982.247-25"`; `isValidPhone("(11) 98765-4321")` true, `"(11) 3456-7890"` true, `"(01) 98765-4321"` false, `"98765-4321"` false.
  - `registration.test.ts`: rpc rejeita com `{ code: "23505", message: '... "profiles_cpf_active_uniq"' }` → lança `"Este CPF já está em uso."`; telefone idem; payload enviado com `p_cpf: "52998224725"` (normalizado).
  - `CompleteRegistrationPage.test.tsx`: não envia com CPF inválido (mostra "CPF inválido." em `alert`), nem sem foto ("Envie uma foto sua."); mostra o texto LGPD exato; envio válido chama `uploadMyPhoto` e depois `completeRegistration` com `photoPath` retornado e depois `refreshProfile`; foto de 3 MB → "A foto precisa ter até 2 MB."
  - `RouteGuards.test.tsx`: `empresa` com `registrationComplete=false` vê o título "Complete seu cadastro" e não o app; `cliente_fisico` com `registrationComplete=false` vê o app; dono existente (`isOwner=true`, sem cadastro) também cai no cadastro.
  - `team.test.sql`: usuário A não consegue `insert` em `storage.objects` com `name = '<B>/photo'`; dono lê objeto do vendedor da própria empresa; vendedor não lê foto do colega.
- [ ] **Step 2: Rodar e ver falhar** — `cd app && npx vitest run src/lib src/profile src/ui/CompleteRegistrationPage.test.tsx src/auth` e `npx supabase@3.1.0 db reset && npx supabase@3.1.0 test db` — Expected: FAIL.
- [ ] **Step 3: Implementar** módulos, página (campos com máscara de CPF/telefone, input de arquivo com preview, botão "Salvar e entrar"), `RequireRegistration` envolvendo `<App />` dentro de `RequireAuth` em `main.tsx`; `AuthProvider` seleciona `full_name, registration_completed_at` e mapeia.
- [ ] **Step 4: Rodar e ver passar** — mesmos comandos + `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: mandatory full registration for company accounts (CPF, phone, role, photo)"`

---

### Task 5: "Meus dados" — editar telefone, cargo e foto

**Files:**
- Create: `app/src/ui/MyDataPanel.tsx`, `app/src/ui/MyDataPanel.test.tsx`
- Modify: `app/src/profile/registration.ts` (+ test), `app/src/App.tsx` (+ `App.test.tsx`)

**Interfaces:**
- Produces: `export async function updateMyContact(input: { phone: string; jobTitle: string; photoPath: string }): Promise<void>` (mesmos mapeamentos de erro de telefone). `MyDataPanel({ onClose }: { onClose?: () => void })` em dialog "Meus dados".
- Consumes: `uploadMyPhoto`, `photoUrl`, `refreshProfile`.

- [ ] **Step 1: Testes que falham** — `MyDataPanel`: mostra nome e CPF formatado **somente leitura** (sem input); salvar telefone/cargo chama `updateMyContact`; trocar foto chama `uploadMyPhoto` antes; erro "Este telefone já está em uso." aparece em `alert`. `App.test`: botão "Meus dados" só para `empresa`.
- [ ] **Step 2: Rodar e ver falhar** — `cd app && npx vitest run src/ui/MyDataPanel.test.tsx src/App.test.tsx src/profile` — Expected: FAIL.
- [ ] **Step 3: Implementar** e montar no topo do App para `role === "empresa"`, envolvido por `RequireRole roles={["empresa"]}`.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando + `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: team members edit their phone, role and photo"`

---

### Task 6: "Minha empresa" com dados da equipe, convite pendente removível

**Files:**
- Modify: `app/src/company/members.ts`, `app/src/ui/CompanyPanel.tsx`, `app/src/ui/CompanyPanel.test.tsx`
- Modify: `supabase/functions/company-revoke-member/handler.ts` (+ test), `supabase/functions/company-revoke-member/index.ts`

**Interfaces:**
- Produces:
```ts
export interface CompanyMember { id: string; fullName: string | null; jobTitle: string | null; email: string | null; cpf: string | null; phone: string | null; photoPath: string | null; isOwner: boolean; active: boolean; registered: boolean }
export async function listCompanyMembers(): Promise<CompanyMember[]>; // rpc("company_team")
```
  - `company-revoke-member`: `RevokeMemberDeps.deactivateColleague` passa a retornar `"revoked" | "removed" | "not_found"`; `"removed"` = usuário nunca entrou (`last_sign_in_at` nulo) → `auth.admin.deleteUser`; resposta 200 `{ result }`. Log `colleague_invite_cancelled` ou `colleague_revoked`.

- [ ] **Step 1: Testes que falham**
  - `CompanyPanel.test`: dono vê nome, cargo, CPF formatado, telefone e foto (img com `alt` = nome) de cada vendedor; vendedor não-dono vê só nome e cargo dos colegas (CPF ausente do DOM); convite pendente aparece como "Convite pendente" com botão "Cancelar convite"; membro ativo com "Revogar"; chamada de `listCompanyMembers` sem argumento.
  - `company-revoke-member/handler.test.ts`: `deactivateColleague` → `"removed"` gera 200 `{ result: "removed" }` e log `colleague_invite_cancelled`; `"not_found"` → 404.
- [ ] **Step 2: Rodar e ver falhar** — `cd app && npx vitest run src/ui/CompanyPanel.test.tsx ../supabase/functions/company-revoke-member` — Expected: FAIL.
- [ ] **Step 3: Implementar** (`index.ts` decide pelo `getUserById(...).last_sign_in_at`).
- [ ] **Step 4: Rodar e ver passar** — mesmo comando + `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: company owner sees team data and can cancel pending invites"`

---

### Task 7: Painel Admin — empresas, equipes e correção de nome/CPF

**Files:**
- Create: `app/src/ui/AdminTeamsPanel.tsx`, `app/src/ui/AdminTeamsPanel.test.tsx`
- Create: `app/src/admin/teams.ts`
- Modify: `app/src/ui/AdminPanel.tsx` (aba/seção "Empresas e equipes"), `supabase/tests/team.test.sql`

**Interfaces:**
- Produces:
```ts
// admin/teams.ts
export interface AdminCompany { id: string; name: string; members: CompanyMember[] }
export async function listCompaniesWithTeams(): Promise<AdminCompany[]>; // select companies + profiles (policies de admin já existentes)
export async function correctIdentity(userId: string, fullName: string, cpf: string): Promise<void>; // update profiles direto (RLS admin); valida CPF no front; mesmos erros de unicidade
```
- [ ] **Step 1: Testes que falham** — `AdminTeamsPanel`: lista empresas e membros com CPF formatado e foto; "Corrigir" abre campos nome/CPF, CPF inválido bloqueia, válido chama `correctIdentity(id, nome, "52998224725")`. `team.test.sql`: admin atualiza `full_name`/`cpf` de vendedor (lives_ok) e o log `profile_data_changed` registra `actor_id` do admin; vendedor tentando `update profiles set cpf=...` direto não altera nada (0 linhas).
- [ ] **Step 2: Rodar e ver falhar** — `cd app && npx vitest run src/ui/AdminTeamsPanel.test.tsx` e `npx supabase@3.1.0 test db` — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** — + `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: admin sees companies with teams and corrects name/CPF"`

---

### Task 8: Verificação ponta a ponta local e publicação na nuvem

**Files:** nenhum novo (só comandos).

- [ ] **Step 1: E2E local** (Supabase local + `functions serve`): dois clientes `supabase-js` com a mesma conta de vendedor; login no primeiro, catálogo lê; login no segundo; primeiro passa a ler 0 linhas e `session_is_current()` = false; Edge Function `company-invite-colleague` com token do primeiro → 401. Vendedor recém-convidado lê 0 linhas do catálogo até completar cadastro. Expected: tudo como descrito.
- [ ] **Step 2: Suítes completas** — `cd app && npm test && npx tsc -b && npm run build` e `npx supabase@3.1.0 db reset && npx supabase@3.1.0 test db` — Expected: tudo verde.
- [ ] **Step 3: Publicar** — `npx supabase@3.1.0 db push --remote --yes` (migrations 0005–0007) e `npx supabase@3.1.0 functions deploy --remote --yes`. Expected: aplicado sem erro. Avisar: todos precisam entrar de novo uma vez (nenhuma sessão está reivindicada ainda).
- [ ] **Step 4: Commit/push** só se o usuário pedir.
