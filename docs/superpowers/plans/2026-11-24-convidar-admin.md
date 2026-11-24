# Convidar admin pelo app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin convida outro admin pelo Painel Admin; a pessoa recebe email, define senha e entra como admin.

**Architecture:** Edge Function `admin-invite-admin` (handler puro com deps injetadas + `index.ts` que liga no Supabase), mesmo padrão de `admin-create-company`. UI: `AdminAdminsPanel` dentro do `AdminPanel`, lista lida do navegador via RLS.

**Tech Stack:** Deno Edge Functions, supabase-js, React 19, vitest (+ testing-library).

**Spec:** `docs/superpowers/specs/2026-11-24-convidar-admin-design.md`

## Global Constraints
- Só admin: papel reconfirmado no servidor (`getCaller`), nunca pela UI.
- CORS = `APP_PUBLIC_URL`. Respostas só com `{ error }` amigável em PT-BR, sem detalhe interno.
- Conta que já existia nunca é apagada nem tem o papel trocado.
- Auditoria: ação `admin_invited`, details `{ invitedUserId, email, reusedAccount }`.

## Review Focus
- Email com maiúsculas/espaços → normalizado (`normalizeEmail`) antes de tudo.
- Email de conta órfã (Auth sem perfil) → vira admin + link *recovery*; não apaga a conta em falha.
- Email com perfil (qualquer papel) → 409 "já tem cadastro", nada muda.
- Falha no email de conta nova → usuário recém-criado é apagado.
- Empresa/cliente chamando a função → 403.

---

### Task 1: Edge Function `admin-invite-admin`

**Files:**
- Create: `supabase/functions/admin-invite-admin/handler.ts`, `handler.test.ts`, `index.ts`
- Modify: `supabase/functions/_shared/errors.ts` (add `ProfileAlreadyExistsError`)

**Interfaces:**
- Produces: `handleInviteAdmin(req: Request, deps: InviteAdminDeps): Promise<Response>`;
  `InviteAdminDeps = { allowedOrigin; getCaller(req) => Promise<Caller|null>; inviteAdmin({ email }) => Promise<{ userId: string; reusedAccount: boolean }>; log(actorId, action, details) => Promise<void> }`.
  `inviteAdmin` lança `EmailAlreadyRegisteredError` quando o email já tem perfil.
- Response 200: `{ userId }`. Body da request: `{ email }`.

- [ ] **Step 1: Testes (vitest) em `handler.test.ts`:** admin + `" Novo@X.com "` → 200, `inviteAdmin` chamado com `{ email: "novo@x.com" }`, log `("a1","admin_invited",{ invitedUserId:"u1", email:"novo@x.com", reusedAccount:false })`; sem login → 401; empresa → 403; email inválido/body nulo → 400; `EmailAlreadyRegisteredError` → 409 com `/já tem cadastro/i`; erro genérico → 500 sem texto interno; OPTIONS → 200 com origem; GET → 405.
- [ ] **Step 2:** `cd app && npx vitest run ../supabase/functions/admin-invite-admin` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `handler.ts` no molde de `admin-create-company/handler.ts`.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5: `index.ts`:** `inviteAdmin`:
  1. `findAuthUserIdByEmail(admin, email)`.
  2. Se existe: `profiles` com esse id existe → lança `EmailAlreadyRegisteredError`. Senão insere perfil `{ id, email, role:"admin", company_id:null, is_owner:false, active:true }` (erro `23505` → `EmailAlreadyRegisteredError`), `createRecoveryLink`, `sendSetPasswordEmail`; `reusedAccount:true`; nunca `deleteUser`.
  3. Se não existe: `createInviteLink`, insere perfil, `sendSetPasswordEmail`; em falha `deleteUser(link.userId)` e relança; `reusedAccount:false`.
  Intro do email: `"Você foi convidado como administrador do Configurador de Lavanderia. Defina sua senha para entrar."`
- [ ] **Step 6:** `deno check supabase/functions/admin-invite-admin/index.ts` (se deno disponível) → sem erro.
- [ ] **Step 7: Commit** `feat: admin-invite-admin edge function`.

### Task 2: Seção "Administradores" no Painel Admin

**Files:**
- Create: `app/src/admin/admins.ts`, `app/src/ui/AdminAdminsPanel.tsx`, `app/src/ui/AdminAdminsPanel.test.tsx`
- Modify: `app/src/ui/AdminPanel.tsx` (renderiza `<AdminAdminsPanel />` antes de `<AdminTeamsPanel />`), `app/src/ui/AdminPanel.test.tsx` (mock de `./AdminAdminsPanel`)

**Interfaces:**
- Consumes: função `admin-invite-admin` (Task 1), body `{ email }`.
- Produces: `listAdmins(): Promise<{ id: string; email: string | null; createdAt: string }[]>` (profiles `role=admin`, order `created_at`; erro → `Error("Não foi possível carregar os administradores.")`).

- [ ] **Step 1: Testes** (mock `../admin/admins` e `../lib/edgeFunctions`): mostra emails da lista; digitar `novo@x.com` em "Email do novo admin" + botão "Convidar admin" → `invokeEdgeFunction("admin-invite-admin", { email: "novo@x.com" })`, status `/convite enviado para novo@x.com/i`, lista recarregada; erro da função → `role=alert` com a mensagem; campo vazio → alerta sem chamar a função.
- [ ] **Step 2:** `cd app && npx vitest run src/ui/AdminAdminsPanel` → FAIL.
- [ ] **Step 3:** Implementar `admins.ts` e `AdminAdminsPanel.tsx` (`<section aria-label="Administradores">`, `<h3>Administradores</h3>`, form com `className="dialog-form"`).
- [ ] **Step 4:** Mesmo comando → PASS; depois `npx vitest run && npx tsc -b` → tudo verde.
- [ ] **Step 5: Commit** `feat: admins section in admin panel`.
