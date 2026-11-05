# Login, papéis e segurança do Configurador de Lavanderia

## Intenção e porquê

Hoje o app é 100% estático, sem backend, sem login — qualquer um com o link
acessa tudo, incluindo a tela de gerenciar catálogo de máquinas
(`CatalogManager.tsx`), que não tem proteção nenhuma (achado confirmado:
qualquer visitante pode adicionar/editar/apagar máquinas do catálogo global).

O negócio agora tem três públicos diferentes que não devem ver/fazer a
mesma coisa:

- **Empresas parceiras** que revendem o app pros clientes delas, cada uma
  trabalhando só com um subconjunto de máquinas que negociou.
- **Clientes físicos** que compram acesso avulso através de um curso
  (plataforma Cakto), só pra montar a planta deles mesmos.
- **O dono do negócio** (ADMIN), que cadastra as empresas, define o
  catálogo de cada uma, e gerencia tudo.

Isso exige autenticação de verdade, com senha armazenada com segurança, e
exige que ações sensíveis (gerenciar catálogo, cadastrar empresa) saiam do
frontend desprotegido e passem a ser controladas por um backend.

## Goals

1. Login com usuário/senha para três papéis: `admin`, `empresa`, `cliente_fisico`.
2. Senha nunca fica em texto puro em lugar nenhum (nem em email, nem em
   log, nem em banco) — hash moderno com salt, feito pelo Supabase Auth.
3. Cada papel só acessa o que faz sentido pra ele (ver matriz abaixo).
4. Catálogo de máquinas sai do localStorage inseguro e vai para o Postgres
   do Supabase, com RLS (regra de acesso por linha) controlando quem lê e
   quem escreve.
5. Provisionamento automático: compra aprovada na Cakto → conta
   `cliente_fisico` criada automaticamente → email de "defina sua senha"
   (nunca senha pronta em texto).
6. Empresa dona da conta pode convidar colegas (mesmo papel, mesmo
   catálogo), cada um com login próprio — sem senha compartilhada.
7. Painel Admin dentro do próprio app (não no painel do Supabase) para
   cadastrar empresa, escolher o catálogo dela e convidar o "dono".
8. Páginas de erro próprias (404, sem permissão, erro de servidor, convite
   inválido/expirado) que não expõem detalhe técnico pro usuário, mas
   registram o detalhe certo nos logs pra quem for investigar.
9. Levantamento de boas práticas de segurança aplicadas de fato no projeto
   (lista na seção "Segurança — o que muda e por quê").

## Non-goals

- Não vamos migrar a planta 2D/3D, ROI ou Conectividade para o backend —
  esses continuam sendo cálculo 100% client-side, como são hoje. O
  backend só entra para autenticação, gestão de empresa/catálogo e o
  webhook da Cakto.
- Não vamos implementar pagamento dentro do app — a cobrança do cliente
  físico continua 100% na Cakto; o app só reage ao webhook de compra
  aprovada.
- Não vamos trocar Vite/React por Next.js. O front continua SPA estático;
  o Supabase entra só como serviço (via `@supabase/supabase-js` +
  Edge Functions), sem mudar a arquitetura do front.
- 2FA fica fora do primeiro recorte (ver "O que fica pro construtor").

## Anti-goals (o que seria falha mesmo funcionando)

- Senha em texto em qualquer email, log ou banco.
- Qualquer chave "service role" (privilegiada) do Supabase indo pro
  bundle do frontend — isso equivale a dar acesso de admin pro banco
  inteiro pra qualquer visitante.
- Catálogo de máquinas continuar editável sem checagem de papel no
  servidor (checagem só na UI não vale nada — qualquer um abre o
  devtools).
- Página de erro mostrando stack trace, SQL, ou qualquer detalhe interno
  pro usuário final.

## Papéis — matriz de acesso

| | ADMIN | EMPRESA (dono + colegas convidados) | CLIENTE FISICO |
|---|---|---|---|
| Planta 2D / 3D | sim | sim | sim |
| Catálogo de máquinas visível | catálogo completo (gerencia) | só o subconjunto negociado pela empresa | catálogo completo |
| Aba ROI | sim | sim | não |
| Aba Conectividade (insights) | sim | sim | não |
| Botão "Gerenciar máquinas" (CatalogManager) | sim | não | não |
| Painel Admin (cadastrar empresa, catálogo, convites) | sim | não | não |
| Convidar colegas | — | sim (dono da empresa) | não |
| Como a conta é criada | — (conta fundadora, criada manualmente uma vez, fora do fluxo normal) | ADMIN cadastra empresa + convida o "dono"; dono convida colegas | automático via webhook da Cakto quando a compra é aprovada |
| Como recebe a senha | — | link de "defina sua senha" por email | link de "defina sua senha" por email |

## Fluxos decididos

**Cadastro de empresa:** ADMIN entra no Painel Admin, cria a empresa,
marca quais máquinas do catálogo ela trabalha, informa o email do dono.
Sistema cria o usuário via Supabase Admin API e manda o email de convite
("defina sua senha", link expira, uso único). Dono define a senha e já
entra vendo só o catálogo da empresa dele.

**Convite de colega:** dono da empresa, dentro do app, convida um colega
pelo email. Mesmo fluxo de link de senha, mesma empresa/catálogo. Dono
pode revogar o acesso de um colega sem afetar os outros.

**Cliente físico:** pessoa compra o extra no curso → Cakto aprova a
compra → dispara webhook assinado para uma Edge Function do Supabase →
function valida a assinatura, cria o usuário `cliente_fisico`, manda
email de "defina sua senha" com a identidade visual do projeto (azul-
marinho, igual ao app).

**Contrato real do webhook da Cakto** (confirmado na documentação oficial,
`docs.cakto.com.br`):

- Evento: `purchase_approved`.
- Autenticidade: header `X-Cakto-Signature` no formato `v1=<hmac-sha256>`
  e header `X-Cakto-Timestamp` (unix seconds). Assinatura = HMAC-SHA256
  de `{timestamp}.{corpo cru da requisição}`, com o `secret` do webhook
  (configurado no painel da Cakto). Rejeitar se o timestamp tiver mais de
  5 minutos de diferença (anti-replay). Hashear os bytes crus, antes de
  qualquer parse de JSON.
- Campos do payload: `data.customer.email` (email do comprador — pra onde
  vai o convite), `data.id` (chave de deduplicação — idempotência: já
  processado esse id, ignora), `data.product.id` (qual produto da Cakto —
  mapeia pra que papel/acesso liberar; hoje só um produto libera
  `cliente_fisico`, mas o campo já vem pronto pra mais produtos no
  futuro).
- Responder 2xx em até 8s (Cakto não reenvia resposta não-2xx
  automaticamente); processar o resto (criar usuário, mandar email) pode
  ser assíncrono depois de confirmar o recebimento.

**Login:** uma única tela de login para os três papéis; depois de
autenticado, o app lê o papel do usuário (tabela `profiles`) e mostra só
as abas/botões correspondentes.

## Modelo de dados (desenho, a validar na implementação)

- `profiles` (espelha `auth.users`): `id`, `role` (`admin`/`empresa`/
  `cliente_fisico`), `company_id` (nulo pra admin/cliente físico),
  `is_owner` (bool, só relevante pra `role = empresa` — distingue o dono,
  que pode convidar/revogar colegas, de um colega convidado, que não
  pode). Se o dono for revogado, a empresa fica sem dono até o ADMIN
  promover outro membro ou cadastrar um novo — não há transferência
  automática.
- `companies`: `id`, `nome`, `criado_em`.
- `company_machines`: `company_id`, `catalog_machine_id` — subconjunto de
  máquinas liberado pra cada empresa.
- Catálogo de máquinas (hoje em `catalog/store.ts` + localStorage) migra
  pra uma tabela Postgres (`catalog_machines`), escrita só por `admin`
  (RLS), leitura conforme o papel (completo pra admin/cliente físico,
  filtrado por `company_machines` pra empresa).
- Tabela de auditoria simples (`admin_actions_log` ou equivalente) para
  ações sensíveis (criar empresa, revogar colega, editar catálogo) — isso
  também alimenta o "o que aconteceu" quando algo dá errado.

## Segurança — o que muda e por quê

- **Hash de senha com salt**: delegado 100% ao Supabase Auth (usa
  algoritmo moderno com salt único por usuário automaticamente) — não
  escrevemos essa lógica na mão, que é onde mais se erra.
- **Nunca senha em texto**: só link de definir senha, expira, uso único
  (`admin.inviteUserByEmail` / equivalente).
- **Nenhuma chave privilegiada no frontend**: a chave anônima do Supabase
  (pública, segura de expor) vai no front; a chave "service role" (que
  cria usuário, ignora RLS) só existe dentro das Edge Functions, nunca em
  código que roda no navegador.
- **RLS em toda tabela sensível**: catálogo, empresas, perfis — o banco
  recusa a query errada mesmo que alguém manipule o frontend.
- **Catálogo sai do localStorage**: hoje é editável por qualquer um sem
  login; migra pra tabela com RLS, só admin escreve.
- **Webhook da Cakto com verificação de assinatura**: sem isso, qualquer
  um poderia chamar o endpoint fingindo ser a Cakto e criar contas de
  graça. Idempotência (não duplicar conta se a Cakto reenviar o mesmo
  evento).
- **Páginas de erro customizadas**: usuário final vê mensagem amigável
  (sem stack trace, sem SQL, sem detalhe de infraestrutura); o detalhe
  técnico de verdade vai só pro log do servidor (Supabase logs / tabela de
  auditoria), pra investigar sem expor nada publicamente.
- **Rate limit de login**: já vem padrão no Supabase Auth, mantemos como
  está (evita força bruta de senha).
- **HTTPS em tudo**, variáveis de ambiente fora do código versionado
  (`.env` no `.gitignore`), sem segredo hardcoded em nenhum arquivo do
  front.

## O que fica pro construtor (decisões menores, sem precisar voltar a perguntar)

- Texto exato dos emails de convite (visual: azul-marinho da marca, igual
  ao app — conteúdo exato é liberdade de quem implementar).
- Nome exato das tabelas/colunas, desde que reflita o modelo acima.
- Biblioteca de ícones/estilo visual do Painel Admin e das páginas de
  erro — seguir o visual já existente do app (`index.css`, paleta atual).
- Formato exato da tabela de auditoria (colunas extras, retenção).
- 2FA, SSO, ou login social: fora do primeiro recorte; se algum dia for
  pedido, é um adicional sobre essa base, não uma mudança nela.
- Mensagens de erro específicas de cada página (contanto que sigam a
  regra "nada de detalhe técnico pro usuário final").

## Restrições

- Front continua Vite + React, SPA, deploy estático — Supabase entra só
  como serviço externo (`@supabase/supabase-js` no client, Edge Functions
  para lógica privilegiada).
- Nada de ROI/Conectividade/engine de planta migra pro backend — o
  backend é só auth + empresa/catálogo + webhook.

## Infraestrutura decidida nesta rodada

- **Domínio**: hoje o app roda no servidor pessoal, sem domínio próprio;
  vai comprar um domínio (ex. Hostinger) — serve pra dois fins: URL fixa
  de redirect dos links de "defina sua senha"/reset do Supabase, e
  domínio verificado pro envio de email de marca.
- **Roteamento**: hoje não existe rota nenhuma (as "abas" são só estado de
  componente, sem `react-router`). Login, páginas de erro (404/sem
  permissão/500/convite expirado) e o retorno do link de definir senha
  precisam de URL própria — entra `react-router` (ou equivalente) como
  parte desse trabalho, mais a configuração de SPA-fallback no servidor
  (toda rota cai no `index.html`) quando o domínio for configurado.
- **Email transacional**: Resend, tier grátis (3.000 emails/mês),
  domínio verificado nele (o mesmo domínio comprado acima) — email de
  convite/reset sai com remetente próprio, não o genérico do Supabase.
- **Seed do catálogo**: migra o catálogo atual do `localStorage` (já tem
  specs reais ajustadas) pra tabela Postgres, em vez de recomeçar do seed
  original do código — preserva o trabalho já feito.
