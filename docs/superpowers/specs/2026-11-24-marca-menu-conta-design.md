# Marca "Sua Lavanderia 3D" e menu da conta — design curto

**Por quê:** o app tem nome de marca e o menu do nome ainda é o de antes do
login (nome/foto só no navegador, "Visitante", itens "em breve", "Entrar na
conta"). O usuário quer a área da pessoa no clique do nome: Meus projetos,
Meus orçamentos e Sair.

**Aprovado pelo usuário (2026-11-24):**
- Marca "Sua Lavanderia 3D" no `<title>`, no topo (h1) e na tela de login.
- Clicar no nome abre o menu: cabeçalho (foto, nome, cargo), **Meus
  projetos**, **Meus orçamentos** (em breve), separador, **Sair**.
- O botão "Sair" solto no topo some.

**Decisões minhas (propostas na conversa, sem objeção):**
- Nome vem de `profile.fullName`; subtítulo = cargo (`loadMyData().jobTitle`)
  para empresa, "Administrador" para admin. Foto vem do cadastro
  (`photoUrl(photoPath)`); sem foto ou erro → iniciais. Trocar foto/nome fica
  em "Meus dados" (sai o campo de nome e o "trocar foto" do menu, e o
  localStorage `lavanderia.perfil.v1` deixa de ser usado).
- "Meus projetos" abre o painel de Clientes (reuniões salvas) — só empresa;
  admin não vê o item.
- "Meus orçamentos" fica desabilitado "em breve" até definirmos o conteúdo.

**Abordagens:** (1) `UserMenu` recebe tudo por props do `App` — escolhida:
o `App` já sabe papel, `signOut` e abre o painel de Clientes; (2) `UserMenu`
lê `useAuth` sozinho e abre painéis por evento global — acopla e duplica
estado; descartada.

**Fora do escopo:** conteúdo de orçamento; projetos para admin.
