# MFA de admin + captcha no login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin só acessa dados depois do código TOTP (exigido no banco e nas functions); login e "esqueci senha" passam por Turnstile.

**Architecture:** Supabase Auth MFA nativo (TOTP). Banco: `current_profile()` exige `aal2` pra admin. Functions: `getCaller` exige `aal2` pra admin. App: `AuthProvider` calcula estado MFA, `RequireMfa` mostra `MfaPage`. Captcha: `TurnstileWidget` na `LoginPage`, token em `options.captchaToken`.

**Tech Stack:** Postgres/pgTAP (supabase test db), Deno functions testadas no vitest, React 19 + supabase-js 2.

**Spec:** `docs/superpowers/specs/2026-11-24-mfa-admin-captcha-design.md`

## Global Constraints
- Empresa e cliente_fisico: nenhuma mudança de comportamento.
- Mensagens ao usuário em PT-BR; nunca mostrar `error.message` do Auth.
- Sem `VITE_TURNSTILE_SITE_KEY` o app funciona sem captcha (dev/local).
- Secret do Turnstile nunca no repositório nem no front.

## Review Focus
- Admin com fator abandonado (não verificado) → consegue recadastrar (remove fator `unverified` antes do `enroll`).
- Código errado → mensagem "Código inválido." e pode tentar de novo, sem deslogar.
- Admin em `aal1` → lê o próprio perfil (pra saber que é admin), mas nada de admin (catálogo admin, empresas, logs).
- Captcha expirado/ausente com site key configurada → botão Entrar desabilitado até ter token; token é resetado após cada tentativa.
- Sessão única continua: `claim_session` funciona em `aal1`, e o upgrade pra `aal2` mantém o mesmo `session_id`.

---

### Task 1: Banco exige aal2 pra admin

**Files:** Create `supabase/migrations/0010_admin_mfa.sql`, `supabase/tests/mfa.test.sql`; Modify `supabase/config.toml` (`[auth.mfa.totp] enroll_enabled = true`, `verify_enabled = true`), testes SQL existentes que usam claims de admin (adicionar `"aal":"aal2"`).

- [ ] **Step 1: `mfa.test.sql`** (pgTAP): admin com sessão reivindicada e `aal1` → `current_profile()` vazio, `count(companies)=0`, `profiles self read` devolve 1 linha; mesmo admin com `"aal":"aal2"` → `current_profile().role='admin'`, lê companies; empresa com `aal1` → `current_profile()` normal.
- [ ] **Step 2:** `npx -y supabase@3.1.0 db reset && npx -y supabase@3.1.0 test db` → `mfa.test.sql` FALHA.
- [ ] **Step 3:** Migration: `create or replace function public.current_profile()` igual à 0007 + `and (p.role <> 'admin' or coalesce(auth.jwt() ->> 'aal', '') = 'aal2')`.
- [ ] **Step 4:** Ajustar claims de admin nos testes antigos; rodar de novo → tudo PASSA.
- [ ] **Step 5: Commit** `feat(db): admin data requires MFA (aal2)`.

### Task 2: Functions exigem aal2 pra admin

**Files:** Modify `supabase/functions/_shared/jwt.ts` (+ `jwtAal(token): string | null`), `jwt.test.ts`, `http.ts` (`getCaller`: `role === "admin"` e `jwtAal(token) !== "aal2"` → null), `http.test.ts`.

- [ ] **Step 1: Testes:** `jwtAal` lê `aal` do payload (`"aal2"`), ausente → `null`, token inválido → `null`; `getCaller` com admin + token `aal1` → `null`, admin + `aal2` → caller.
- [ ] **Step 2:** `cd app && npx vitest run ../supabase/functions/_shared` → FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mesmo comando → PASSA.
- [ ] **Step 5: Commit** `feat(edge): admin calls require MFA (aal2)`.

### Task 3: Tela de código no celular

**Files:** Create `app/src/auth/mfa.ts`, `app/src/auth/mfa.test.ts`, `app/src/ui/MfaPage.tsx`, `app/src/ui/MfaPage.test.tsx`; Modify `app/src/auth/types.ts`, `AuthProvider.tsx`, `RouteGuards.tsx` (+ `RequireMfa`), `App.tsx`/rotas onde `RequireRegistration` é usado.

**Interfaces:**
- `type MfaState = "ok" | "enroll" | "verify"`; `Profile.mfa: MfaState` (não-admin sempre `"ok"`).
- `mfaStateFor(role: Role): Promise<MfaState>` — admin: `getAuthenticatorAssuranceLevel()`; `currentLevel==="aal2"` → ok; senão `listFactors()`: tem TOTP `verified` → verify; senão enroll.
- `startEnroll(): Promise<{ factorId: string; qrCode: string; secret: string }>` — remove fatores TOTP `unverified`, `mfa.enroll({ factorType: "totp", friendlyName: "Configurador" })`.
- `verifyCode(factorId: string, code: string): Promise<void>` — `mfa.challengeAndVerify`; erro → `Error("Código inválido.")`.
- `verifiedFactorId(): Promise<string | null>`.
- `MfaPage({ mode: "enroll" | "verify", onDone: () => Promise<void> })`; `onDone` = `refreshProfile` (recarrega perfil + catálogo em aal2).

- [ ] **Step 1: Testes** (`mfa.test.ts` com supabase mockado): `mfaStateFor("empresa")` → ok sem chamar mfa; admin aal2 → ok; admin aal1 + fator verified → verify; admin aal1 sem fator → enroll; `startEnroll` remove `unverified` antes; `verifyCode` com erro → "Código inválido.". `MfaPage.test.tsx`: enroll mostra QR (`img` alt "QR code") + segredo; digitar 6 dígitos + "Confirmar" chama `verifyCode` e `onDone`; erro mostra `role=alert` "Código inválido."; botão "Sair" chama signOut. `RouteGuards.test.tsx`: admin com `mfa:"verify"` → MfaPage; `mfa:"ok"` → filhos.
- [ ] **Step 2:** `npx vitest run src/auth src/ui/MfaPage` → FALHA.
- [ ] **Step 3:** Implementar; `AuthProvider.loadProfile` preenche `mfa`; `refreshProfile` recalcula.
- [ ] **Step 4:** `npx vitest run && npx tsc -b` → PASSA.
- [ ] **Step 5: Commit** `feat(auth): TOTP step for admins`.

### Task 4: Turnstile no login

**Files:** Create `app/src/ui/TurnstileWidget.tsx`, test; Modify `app/src/ui/LoginPage.tsx`, `LoginPage.test.tsx`, `app/.env.example` (`VITE_TURNSTILE_SITE_KEY=`), `supabase/config.toml` (comentário `[auth.captcha]`).

**Interfaces:** `TurnstileWidget({ siteKey: string, onToken: (token: string | null) => void, resetSignal: number })` — carrega `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` uma vez, `turnstile.render` com `callback`, `expired-callback`/`error-callback` → `onToken(null)`; muda `resetSignal` → `turnstile.reset`.

- [ ] **Step 1: Testes** (`LoginPage.test.tsx`, widget mockado): sem site key → sem widget, login sem `captchaToken`; com site key → botão Entrar desabilitado até token; login envia `options: { captchaToken: "tok" }`; "Esqueci minha senha" envia `captchaToken`; após tentativa falha o widget é resetado.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar. **Step 4:** `npx vitest run && npx tsc -b` → PASSA.
- [ ] **Step 5: Commit** `feat(auth): Turnstile captcha on login`.
