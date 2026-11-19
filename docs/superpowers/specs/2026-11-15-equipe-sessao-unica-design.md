# Cadastro completo da equipe e sessão única (anti login compartilhado)

## Intenção e porquê

O app vai ser vendido B2B. O ADMIN (dono do negócio) cadastra uma empresa
parceira, e o dono dessa empresa convida vendedores ("prospects") que usam
o app em reuniões com quem quer abrir uma lavanderia: mostram a planta 2D,
o 3D, o ROI e a Conectividade, e fecham a venda ali.

O dono da empresa coordena a própria equipe e pode adicionar **quantos
vendedores quiser** — não há limite de vagas (decisão do dono do
negócio). O risco que este trabalho fecha (o primeiro dos três
levantados — os outros dois ficam pra depois, ver Non-goals) é
**login compartilhado** (várias pessoas usando a mesma conta) e
**pessoa sem identificação** usando o app. Duas peças que funcionam
juntas:

1. **Cadastro completo e único de cada pessoa da equipe** (identidade
   verificável: toda conta corresponde a uma pessoa real e identificada).
2. **Sessão única por conta**: entrar num aparelho derruba o anterior —
   uma conta, um aparelho por vez.

Base existente (spec `2026-11-04-auth-security-design.md`, já em produção
no projeto Supabase "Laundry App"): papéis `admin` / `empresa` (dono com
`is_owner`, colegas sem) / `cliente_fisico`; convite por link de uso
único; RLS via `current_profile()`; Edge Functions para ações
privilegiadas; `admin_actions_log`. O "vendedor" deste documento é o
colega da empresa que já existe hoje (papel `empresa`, `is_owner = false`)
— não é papel novo.

## Goals

1. **Cadastro completo no primeiro acesso, sempre.** Toda pessoa de
   empresa (dono e vendedores) que entra pela primeira vez, depois de
   definir a senha, preenche nome completo, CPF, telefone, cargo e
   foto antes de ver qualquer tela do app. Sem cadastro completo ele não
   usa o app — e isso vale no servidor (RLS/functions), não só na tela.
2. **CPF válido e único entre contas ativas** (dígitos verificadores). A
   mesma pessoa não tem duas contas ativas nem está em duas empresas ao
   mesmo tempo. Telefone
   também único. Tentativa com CPF/telefone já usado é recusada com
   mensagem clara e registrada no log de auditoria.
3. **Sessão única por conta.** Para todos os papéis (inclusive ADMIN —
   minha decisão, aceita pelo dono do negócio): a cada login, qualquer
   outra sessão da mesma conta é encerrada na hora. O aparelho derrubado
   volta pro login com a mensagem: *"Seu acesso neste aparelho foi
   encerrado porque a conta entrou em outro aparelho."*
4. **Registro de logins e derrubadas**, só como histórico: cada login
   guarda horário, IP e aparelho (user agent); cada derrubada também fica
   registrada. **Não há alerta nem cobrança de explicação** — decisão do
   dono do negócio: a sessão única por si só já basta; ninguém é
   questionado por cair várias vezes.
5. **Painel Admin:** lista de empresas e, em cada uma, a equipe com os
   dados cadastrais e foto.
6. **"Minha empresa" (dono):** a equipe dele com os dados cadastrais e
   foto de cada um, convite sem limite, revogação.

## Non-goals (ficam pra projetos seguintes, nesta ordem provável)

- **Dados dos clientes finais (leads)** que o vendedor atende na reunião —
  dados básicos guardados pra empresa parceira. Projeto próprio.
- **Proteção contra clonagem** (mover partes críticas — ROI, motor de
  planta — pro servidor). Contradiz a decisão atual de manter isso 100%
  client-side; é projeto maior, à parte.
- **Marca fixa / anti-revenda como produto deles** (sua marca em tela,
  PDF, imagem 3D; logo da parceira ao lado, nunca no lugar). Projeto
  próprio.
- Confirmação de telefone por SMS (custo por mensagem) — pode vir depois.
- Validação de CPF contra a Receita Federal (serviço pago) — só dígitos
  verificadores por enquanto.
- Alertas de login compartilhado / contagem de derrubadas por semana
  (ideia de "20 derrubadas = aviso" foi descartada pelo dono do negócio).
- Bloqueio automático por derrubadas.
- Limite de vendedores por empresa (descartado pelo dono do negócio: o
  dono da empresa adiciona quantos quiser).

## Anti-goals (falha mesmo funcionando)

- Vendedor conseguir usar o app (ler catálogo, etc.) sem cadastro
  completo, só pulando a tela no navegador.
- Duas sessões da mesma conta conseguirem ler dados ao mesmo tempo depois
  do segundo login, mesmo que só por alguns minutos — o token antigo ainda
  "válido" não pode continuar lendo.
- Foto/CPF/telefone de um vendedor visíveis pra outra empresa ou para
  colegas da mesma empresa (ver "Quem vê o quê").
- Aviso de derrubada que vaze dados da outra sessão (IP, cidade) pro
  aparelho derrubado — a mensagem é genérica.
- CPF ou telefone em log de erro do cliente ou em mensagem de erro na tela
  de forma que identifique outra pessoa ("este CPF pertence a Fulano").

## Quem vê o quê

| Dado | ADMIN | Dono da empresa | Vendedor (ele mesmo) | Outro vendedor da mesma empresa | Outra empresa |
|---|---|---|---|---|---|
| Nome, cargo | sim | sim | sim | sim (lista da equipe) | não |
| CPF, telefone, foto | sim | sim | sim | não | não |
| Histórico de logins/derrubadas | sim (consulta no banco; sem tela própria) | não | não | não | não |


## Fluxos

**ADMIN cadastra empresa:** igual hoje. O Painel Admin ganha a lista de
empresas com a equipe de cada uma.

**Dono convida vendedor:** igual hoje, sem limite de quantidade. Pode
cancelar um convite que ainda não foi aceito.

**Primeiro acesso do vendedor:** define senha → tela "Complete seu
cadastro" (nome completo, CPF, telefone, cargo, foto) → salvar → entra no
app. Enquanto não completar, qualquer rota cai nessa tela, e o servidor
nega leitura do catálogo pra ele.

**O dono da empresa também preenche o cadastro completo** no primeiro
acesso — todos da equipe preenchem, sempre (decisão do dono do negócio).

**Login em aparelho novo:** o login novo vale; todas as outras sessões da
conta caem. O aparelho antigo, na próxima ação (ou em poucos segundos se
estiver parado na tela), volta pro login com a mensagem de aviso.

**Revogação e CPF:** revogar um vendedor **libera o CPF e o telefone**
na hora — decisão do dono do negócio. A pessoa pode ser recontratada ou ir
pra outra empresa. A unicidade de CPF/telefone vale entre contas
**ativas**: a mesma pessoa nunca tem duas contas ativas ao mesmo tempo.
Os dados da conta revogada ficam guardados (histórico), só não bloqueiam
mais o CPF.

**Quem preenche o cadastro completo:** só contas de empresa (dono e
vendedores). Cliente físico (Cakto) e ADMIN não passam pela tela de
cadastro — decisão minha (o risco de fraude é das empresas parceiras).

**Edição depois do cadastro:** o vendedor pode alterar telefone, cargo e
foto. Nome completo e CPF só o ADMIN corrige. Toda alteração vai pro log
de auditoria — decisão minha.

## Restrições

- Mesma arquitetura: SPA Vite/React, Supabase (Postgres + RLS + Auth +
  Edge Functions + Storage). Nada de chave service_role no navegador.
- Projeto Supabase está no **plano grátis**: o recurso pronto "single
  session per user" do Supabase Auth é pago, então a sessão única precisa
  ser implementada no app. Sugestão (não obrigatória): guardar por conta o
  `session_id` ativo (vem no JWT), chamar `signOut({ scope: "others" })`
  no login pra matar os refresh tokens das outras sessões, e fazer a RLS
  (`current_profile()`) exigir que o `session_id` do JWT seja o ativo —
  isso corta o token antigo na hora, que é o anti-goal acima.
- Foto em bucket **privado** do Supabase Storage, com policy espelhando a
  tabela "Quem vê o quê"; limite de tamanho e só imagem.
- LGPD: CPF, telefone e foto são dados pessoais. Coletar só esses, mostrar
  um aviso curto no formulário dizendo pra que servem (identificação do
  vendedor e controle de acesso), não expor em logs.
- Contas de empresa que já existem (ex.: dono da "Lavanderia Gustavo")
  passam pelo cadastro completo no próximo acesso.
- Tudo com o mesmo padrão de testes do projeto (vitest + pgTAP para RLS).

## O que fica pro construtor

- Nomes de tabelas/colunas, formato do registro de logins.
- Como o aparelho derrubado percebe rápido (realtime, polling curto, ou
  na próxima requisição negada) — desde que a leitura já seja negada no
  servidor na hora.
- Layout das telas novas, seguindo o visual atual do app.
- Formato aceito de telefone (sugestão: celular brasileiro com DDD).
- Compressão/redimensionamento da foto antes do upload.
