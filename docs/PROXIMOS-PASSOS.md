# Próximos passos (atualizado em 2026-11-19)

## Onde está cada coisa

- **App no ar:** https://configurador-lavanderia.yankzinnn.workers.dev
  (Cloudflare Worker; tudo que entra na `main` é publicado sozinho).
- **Banco:** Supabase "Laundry App" (`mxjdxstnhvczqedavuzv`), migrations
  0001–0009 aplicadas na nuvem.
- **Admin:** `yancarlostrab@gmail.com` (senha definida pelo link de
  `app/scripts/create-admin.ts`).
- **Domínio:** `grupomgrp.com.br` com DNS na Cloudflare
  (harlan/cortney.ns.cloudflare.com).

## Já pronto

- Login, papéis (admin / empresa dono + vendedores / cliente físico),
  convites, recuperação de senha, webhook Cakto.
- Cadastro completo da equipe, foto, CPF/telefone únicos, sessão única
  por conta (login novo derruba o aparelho antigo).
- **Clientes (leads) com reunião salva**: uma reunião por cliente,
  logo em WebP, transferência pelo dono, planilha CSV pro CRM.
  Spec: `docs/superpowers/specs/2026-11-19-clientes-reunioes-design.md`.

## Configurar o PC novo

1. Instalar Node 22+, Docker (pro Supabase local) e git.
2. `git clone` do repositório e `cd app && npm ci`.
3. Copiar **à mão** (não estão no git, são secretos), por pendrive ou
   gerenciador de senhas — nunca por chat/email:
   - `app/.env` (URL e anon key do Supabase)
   - `supabase/functions/.env` (RESEND_API_KEY, segredo do webhook Cakto)
4. `npx -y supabase@3.1.0 login` e
   `npx -y supabase@3.1.0 link --project-ref mxjdxstnhvczqedavuzv`.
5. Local: `npx -y supabase@3.1.0 start`, depois `db reset` e o catálogo:
   `cd app && SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<chave local do "supabase status"> npx -y tsx scripts/seed-catalog-from-export.ts --from-seed`
6. Testes: `cd app && npx vitest run && npx tsc -b` e
   `npx -y supabase@3.1.0 test db` (na raiz).

Ordem para publicar mudanças: **banco primeiro**
(`npx -y supabase@3.1.0 db push --remote --yes`), depois funções
(`functions deploy`), por último `git push` na `main`.

## Fila (em ordem)

1. **Endereço do app nos links de email** — convites e "esqueci minha
   senha" ainda apontam pro `localhost`. Decidir o endereço final
   (`app.grupomgrp.com.br` ou o `.workers.dev`) e trocar no Supabase da
   nuvem: Authentication → URL Configuration (`Site URL` + redirect
   `<endereço>/set-password`) e o secret `APP_PUBLIC_URL` das funções.
2. **Domínio** — no Worker: Settings → Domains & Routes → Add → Custom
   domain → `app.grupomgrp.com.br`. Depois verificar o domínio no Resend
   e trocar o remetente para `nao-responda@grupomgrp.com.br`.
3. **Modo claro como padrão** — quem nunca escolheu abre no claro; o
   botão de tema continua.
4. **Cakto** — colocar o segredo real do webhook em
   `supabase/functions/.env`, informar o id do produto. URL do webhook:
   `https://mxjdxstnhvczqedavuzv.supabase.co/functions/v1/cakto-webhook`.
5. **Planos pagos antes de vender de verdade** — Supabase Pro (o grátis
   estoura em ~7 semanas no pior caso de uso, e o Pro tem backup) e
   Resend Pro.
6. Projetos futuros: anti-clonagem, depois marca fixa.

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
