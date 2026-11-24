# Código no celular para admin + captcha no login — design (curto)

**Aprovado em 2026-11-24.**

## Por quê
Admin vê e edita tudo. Senha roubada de admin = vazamento total. E o login
público aceita tentativas automáticas (robôs). Verificador do Supabase
apontou poucas opções de MFA.

## Objetivo
### 1. MFA (TOTP) obrigatório para admin
- Depois da senha (ou do link de definir senha), admin sem fator cadastrado
  vê tela com QR code + campo do código; com fator, vê só o campo do código.
  Sem passar, não entra no app.
- **Servidor exige**: `current_profile()` não devolve linha de admin sem
  `aal2` no JWT → RLS nega tudo que é de admin. `getCaller` das Edge
  Functions devolve null pra admin sem `aal2`.
- A leitura do próprio perfil ("profiles self read") continua liberada em
  `aal1` — é como o app descobre que a conta é admin.
- Empresa e cliente: sem mudança.
- Perdeu o celular: apagar o fator no painel do Supabase
  (Authentication → Users → pessoa → MFA); recadastra no próximo login.

### 2. Captcha (Cloudflare Turnstile) no login
- Widget Turnstile na tela de login; token vai em `signInWithPassword` e
  `resetPasswordForEmail` (`options.captchaToken`). O Supabase valida.
- Site key em `VITE_TURNSTILE_SITE_KEY`; sem ela o widget não aparece
  (dev/local continuam funcionando). Secret key só no painel do Supabase.
- Ordem de publicação: app com widget primeiro, depois ligar captcha no
  Supabase (Authentication → Attack Protection).

## Fora do escopo
MFA para empresa/cliente; códigos de recuperação próprios; captcha em
outras telas.

## Abordagens
- MFA nativo do Supabase Auth (TOTP) + checagem de `aal` no banco e nas
  functions — **escolhida**: sem serviço novo, enforcement no servidor.
- Só checar na tela — descartada: senha roubada + API direta passaria.
- SMS — descartada: custo e SIM swap.
- Captcha nativo do Supabase com Turnstile — **escolhida** (Cloudflare já
  usado). Captcha validado em Edge Function própria — descartado: o
  endpoint do Auth continuaria aberto.

## Decisões do construtor
- Estado MFA calculado no `AuthProvider` (`mfa: "ok" | "enroll" |
  "verify"`) via `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` e
  `listFactors()`; guarda `RequireMfa` ao lado de `RequireRegistration`.
- Fator TOTP não verificado (cadastro abandonado) é removido antes de
  cadastrar de novo.
- Migration `0010_admin_mfa.sql`; `config.toml` liga TOTP local.
