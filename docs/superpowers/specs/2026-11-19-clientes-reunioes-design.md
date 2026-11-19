# Clientes (leads) e reunião salva

## Intenção e porquê

O app é vendido B2B. Os vendedores das empresas parceiras usam o app em
reuniões com quem quer abrir uma lavanderia (planta 2D, 3D, ROI e
Conectividade). Hoje nada da reunião fica salvo: a planta e as
calculadoras vivem só no navegador do vendedor, e a próxima reunião
apaga a anterior. Os contatos se perdem.

A empresa parceira quer **guardar os clientes atendidos e o que foi
mostrado a cada um**, e depois levar esses contatos para o CRM dela. Quem
usa: os **vendedores** (o "pessoal do lead") registram os próprios
clientes; o **dono da empresa** (o "gerente") acompanha os clientes de
toda a equipe e exporta. O ADMIN (dono do negócio) só fornece o app e faz
manutenção — não trabalha esses leads.

Base existente (specs `2026-11-04-auth-security-design.md` e
`2026-11-15-equipe-sessao-unica-design.md`, ambas em produção): papéis
`admin` / `empresa` (dono `is_owner` + vendedores) / `cliente_fisico`;
cadastro completo obrigatório e sessão única para contas de empresa; RLS
via `current_profile()` (que já exige sessão atual e cadastro completo);
Storage privado com policies; `admin_actions_log`.

## Goals

1. **Cadastro de cliente pelo vendedor.** Campos: nome (obrigatório),
   telefone, email, CNPJ (opcional; validado se preenchido), "já tem ponto
   comercial?" (sim/não), endereço, tamanho do ponto em m² (se tiver),
   observações. Data de criação/atualização e vendedor responsável são
   preenchidos sozinhos. Pelo menos um meio de contato (telefone ou email)
   — decisão minha (lead sem contato não serve pro CRM).
2. **Reunião salva junto do cliente — uma só por cliente.** "Salvar
   reunião" guarda o estado completo da tela naquele momento: planta
   (medidas, orientação, máquinas, porta, mobiliário e posições), fachada
   (logo, estilo, cores), ROI e Conectividade. Salvar de novo **sobrescreve**
   a anterior (decisão do dono do negócio: sem histórico de versões).
3. **Reabrir a reunião.** "Abrir reunião" coloca tudo de volta na tela como
   estava, pra continuar de onde parou. O app redesenha planta/3D/PDF a
   partir do estado salvo (não guarda imagens prontas).
4. **Quem vê o quê:** vendedor vê e edita só os próprios clientes; dono vê
   todos os clientes da empresa (com o nome do vendedor), abre qualquer
   reunião pra ver e exporta; só o vendedor responsável salva por cima da
   reunião dele (decisão minha). Nenhuma outra empresa vê nada.
5. **Exportar pro CRM:** botão "Baixar planilha (CSV)" pro dono, com todos
   os clientes da empresa (campos do cliente + vendedor + datas + um resumo
   da reunião: área, máquinas, investimento e retorno do ROI). CSV porque
   quase todo CRM importa (RD Station, HubSpot, Pipedrive, Agendor).
6. **Cliente repetido:** se outro vendedor da mesma empresa já tem cliente
   com o mesmo CNPJ ou telefone, o app avisa ("Este cliente já está com
   <nome do colega>") — avisa, não bloqueia (decisão minha).
7. **Logo mais leve.** A logo continua chegando em PNG (fundo
   transparente). Ao subir, o app reduz pra no máximo ~1000 px e converte
   pra WebP com transparência; onde o navegador não gera WebP (Safari),
   guarda PNG reduzido. Vale também pro upload de logo que já existe na
   fachada.

## Non-goals

- Mais de uma reunião por cliente / histórico de versões.
- Integração direta com um CRM específico (API). Só CSV por enquanto.
- ADMIN ver os clientes das empresas na tela.
- Funil de vendas, status do lead, lembretes, agenda.
- Anti-clonagem e marca fixa (projetos seguintes).
- Validação de CNPJ na Receita (só dígitos verificadores).

## Anti-goals

- Vendedor ver ou alterar cliente de colega, ou cliente de outra empresa —
  por qualquer caminho (API direta incluída), não só pela tela.
- Abrir a reunião de um cliente e perder o trabalho que estava na tela sem
  aviso (precisa confirmar quando há algo não salvo).
- Reunião reaberta que quebra a tela porque o catálogo mudou (máquina
  removida do catálogo da empresa): deve abrir mesmo assim, sem a máquina
  que sumiu, com aviso.
- Logo de um cliente visível pra outra empresa.
- CSV que vira planilha quebrada no Excel brasileiro (acentos, separador).

## Restrições

- Mesma arquitetura: SPA Vite/React + Supabase (Postgres/RLS, Storage).
  Regras de acesso no servidor (RLS); a tela só reflete.
- Tudo atrás de `current_profile()` (sessão única + cadastro completo já
  valem automaticamente).
- Peso: ~5 KB por reunião no banco; logo no Storage (bucket privado). Ver
  estimativa de uso no fim.
- LGPD: são dados pessoais de terceiros (clientes da parceira). Sem dado
  além dos listados; sem CPF do cliente.
- Testes no padrão do projeto (vitest + pgTAP).

## Approaches (como guardar a reunião)

1. **Guardar o estado da tela (números e escolhas) e redesenhar ao abrir**
   — escolhida. Leve (~5 KB), continua editável, PDF/3D saem iguais.
2. Guardar PDF/imagens prontas — descartada: centenas de vezes mais
   pesado e não deixa continuar editando.
3. Guardar só no navegador do vendedor — descartada: o dono não vê e
   trocar de aparelho perde tudo.

## Uso estimado (pior caso informado pelo dono do negócio)

4 empresas × 20 vendedores × 7 reuniões/dia × 22 dias = 12.320 reuniões
por mês, todas com logo. Banco ~100 MB/mês; logos ~0,6–1,2 GB/mês. Plano
grátis do Supabase estoura em ~7 semanas (arquivos primeiro); no Pro dura
anos. Recomendação já dada: Supabase Pro antes da primeira empresa usar
de verdade.

## Decisões minhas (o dono do negócio delegou; revisar quando puder)

1. **Dono também atende:** o dono cadastra clientes e salva reuniões como
   responsável, igual a um vendedor.
2. **Vendedor revogado:** os clientes dele continuam visíveis pro dono, que
   pode **transferir** o cliente pra outro membro ativo da empresa (ou pra
   si). Só o dono troca o responsável.
3. **Editar e excluir:** o vendedor edita e exclui os próprios clientes; o
   dono edita e exclui qualquer cliente da empresa (LGPD: pedido de
   exclusão precisa ter quem atenda). Exclusão é definitiva e leva a logo
   junto; fica registrada na auditoria (só o id, sem dados pessoais).
4. **Salvar reunião:** só o responsável pelo cliente. Gravado por função no
   servidor, não por edição direta da tabela.
5. **Reunião aberta fica "ligada" ao cliente:** a tela mostra "Reunião de
   <cliente>" e "Salvar reunião" grava nele, até o vendedor fechar ou abrir
   outra. Quando o dono abre a reunião de um vendedor, ele pode mexer na
   tela, mas não salva por cima (botão desativado com explicação).
6. **Só contas de empresa:** cliente físico (Cakto) e admin não têm a
   função; o servidor nega.
7. **Cliente repetido:** a checagem olha todos os clientes da empresa
   (inclusive os do próprio vendedor e de vendedores revogados) e devolve
   só o nome do responsável — nenhum outro dado do cliente do colega.
8. **Logo na fachada:** reduzida/convertida na hora do upload e mantida na
   tela; só vai pro armazenamento ao "Salvar reunião" (sem arquivo órfão).

## O que fica pro construtor

- Nomes de tabelas/colunas e formato do estado salvo (com versão, pra
  migrar no futuro).
- Layout das telas "Clientes" e do formulário, seguindo o visual atual.
- Detalhes do CSV (separador `;` e BOM UTF-8 pro Excel BR são esperados).
- Como avisar trabalho não salvo antes de abrir outra reunião.
