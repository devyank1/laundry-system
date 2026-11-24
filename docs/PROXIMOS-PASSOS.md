# Próximos passos (atualizado em 2026-11-24)

## Onde está cada coisa

- **App no ar:** https://grupomgrp.com.br (Cloudflare Worker; tudo que
  entra na `main` é publicado sozinho). O `.workers.dev` ainda abre, mas
  as funções só aceitam chamadas do domínio.
- **Banco:** Supabase "Laundry App" (`mxjdxstnhvczqedavuzv`), migrations
  0001–0011 aplicadas na nuvem.
- **Emails:** Resend com o domínio verificado, remetente
  `nao-responda@grupomgrp.com.br` (funções e SMTP do Supabase).
- **Domínio:** `grupomgrp.com.br` com DNS na Cloudflare.

## Já pronto

- **Só B2B**: papéis admin e empresa (dono + vendedores). Sem cliente
  físico e sem Cakto (removidos em 2026-11-24; a venda é fora do app).
- Login, convites, recuperação de senha, cadastro completo da equipe,
  foto, CPF/telefone únicos, sessão única por conta.
- **Admin convida admin** pelo Painel Admin → Administradores.
- **Admin exige código no celular (TOTP)**: banco (`current_profile` só
  com aal2) e funções também exigem. Perdeu o celular: apagar o fator em
  Authentication → Users → pessoa → MFA.
- **Captcha (Turnstile)** no login e no "esqueci minha senha"
  (`VITE_TURNSTILE_SITE_KEY` no `app/.env` e nas variáveis de build do
  Worker; a secret só no Supabase → Attack Protection).
- **Modo claro** é o padrão.
- **Clientes (leads) com reunião salva**: uma reunião por cliente,
  logo em WebP, transferência pelo dono, planilha CSV pro CRM.

## Configurar o PC novo

1. Instalar Node 22+, Docker (pro Supabase local) e git.
2. `git clone` do repositório e `cd app && npm ci`.
3. Copiar **à mão** (não estão no git, são secretos), por pendrive ou
   gerenciador de senhas — nunca por chat/email:
   - `app/.env` (URL e anon key do Supabase, site key do Turnstile)
   - `supabase/functions/.env` (RESEND_API_KEY)
4. `npx -y supabase@3.1.0 login`.
5. Local: `npx -y supabase@3.1.0 start`, depois `db reset` e o catálogo:
   `cd app && SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<chave local do "supabase status"> npx -y tsx scripts/seed-catalog-from-export.ts --from-seed`
6. Testes: `cd app && npx vitest run && npx tsc -b` e
   `npx -y supabase@3.1.0 test db` (na raiz).

Ordem para publicar mudanças: **banco primeiro**
(`npx -y supabase@3.1.0 db push --remote=mxjdxstnhvczqedavuzv --yes`),
depois funções (`functions deploy <nome> --project-ref mxjdxstnhvczqedavuzv`),
por último `git push` na `main`.

## Fila (em ordem)

1. **Ligar o captcha no Supabase** — Authentication → Attack Protection →
   Turnstile + secret key. Conferir: login pela API sem token deve falhar
   com erro de captcha.
2. **Planos pagos antes de vender de verdade** (a decidir) — Supabase Pro
   (o grátis estoura em ~7 semanas no pior caso de uso; o Pro tem backup e
   proteção contra senhas vazadas) e Resend Pro.
3. Projetos futuros: anti-clonagem, depois marca fixa.

## Pendências pequenas (não urgentes)

Clientes:
- Abrir reunião com o catálogo não carregado tira todas as máquinas.
- Excluir cliente apaga a logo antes do cadastro e ignora erro nisso.
- Logo acima de 2 MB que não pôde ser reduzida impede salvar
  (mensagem genérica).
- Pode aparecer uma vez um aviso de "alterações não salvas" sem motivo.
- Reunião com dados malformados quebra ao abrir.
- CSV: tab/quebra de linha no início do campo não são protegidos.
- `clients.seller_id` sem `ON DELETE` (excluir usuário com clientes falha).

Equipe/sessão:
- Corrida entre dois logins simultâneos no `claim_session`.
- `company_team()` não exige cadastro completo.
- Dígitos do CPF do admin só validados no navegador.
- Falha ao reivindicar a sessão mostra "Email ou senha incorretos.".
- Erros de tela de usuários derrubados/sem cadastro não são registrados.
- Revogar devolve sucesso mesmo se o bloqueio no Auth falhar.

Login:
- Falha no envio do email de "esqueci minha senha" não aparece na tela
  (a mensagem é sempre a mesma).
