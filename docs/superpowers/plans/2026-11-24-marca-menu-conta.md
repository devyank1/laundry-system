# Marca e menu da conta — plano

**Spec:** `docs/superpowers/specs/2026-11-24-marca-menu-conta-design.md`

### Task 1: Marca
- `app/index.html` `<title>`, `App.tsx` h1, `LoginPage.tsx` subtítulo →
  "Sua Lavanderia 3D". Teste em `App.test.tsx`: heading "Sua Lavanderia 3D".

### Task 2: Menu da conta
- `UserArea.tsx`: `UserMenu({ name, subtitle, photoPath, onProjects, onSignOut })`
  — `onProjects` opcional (sem ele o item não aparece). Foto via `photoUrl`;
  iniciais se nula/erro.
- Novo `app/src/ui/UserMenu.test.tsx`: mostra nome/subtítulo; Meus projetos
  chama `onProjects`; sem `onProjects` não há item; Meus orçamentos
  desabilitado; Sair chama `onSignOut`.
- `App.tsx`: remove botão Sair do topo; carrega `loadMyData` (jobTitle,
  photoPath) uma vez; passa props. `App.test.tsx`: Sair agora via menu do nome;
  "Meus projetos" só para empresa e abre Clientes.
- Verificar: `npx vitest run --maxWorkers=2`, `npx tsc -b`. Commit, merge, push.
