# Convidar admin pelo app — design (curto)

**Aprovado em 2026-11-24.**

## Por quê
Hoje criar outro admin exige SQL ou painel do Supabase; o convite pelo
painel do Supabase já deixou um colega com conta sem senha e sem papel.
O admin quer: digitar o email, a pessoa recebe o email, define a senha e
já entra como admin.

## Objetivo
- Painel Admin ganha a seção **Administradores**: lista (email + data) e
  campo "Convidar admin".
- Nova Edge Function `admin-invite-admin`, só aceita admin (reconfirmado
  no servidor via `getCaller`), CORS = `APP_PUBLIC_URL`.
- Email novo: cria usuário sem senha (`createInviteLink`), grava perfil
  `role=admin`, manda o email de definir senha (`sendSetPasswordEmail`).
  Falha no perfil/email desfaz o usuário recém-criado.
- Email que já existe no Auth **sem perfil** (conta órfã, ex.: convite
  pelo painel do Supabase): grava perfil admin e manda link de
  *recovery* (definir senha). Nunca apaga essa conta.
- Email que já tem perfil (admin, empresa ou cliente): 409 com aviso.
  O app nunca muda o papel de ninguém.
- Auditoria: `admin_invited` com `{ invitedUserId, email, reusedAccount }`.

## Fora do escopo
Remover/desativar admin (precisa de regra extra, ex.: não remover o
fundador). Fica pra outra etapa.

## Abordagens
1. **Edge Function dedicada (escolhida)** — mesmo padrão de
   `admin-create-company` (handler puro testado + `index.ts` fino);
   service_role só no servidor.
2. RPC SQL `security definer` chamada pelo navegador — não consegue criar
   usuário no Auth nem mandar email; descartada.
3. Reaproveitar `admin-create-company` com flag — mistura dois fluxos e
   piora as mensagens de erro; descartada.

## Decisões do construtor
- Lista de admins lida direto do navegador (`profiles` com `role=admin`);
  a policy "profiles admin all" já permite ao admin.
- Componente separado `AdminAdminsPanel` dentro do `AdminPanel`, como o
  `AdminTeamsPanel`.
