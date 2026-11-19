# Clientes (leads) e reunião salva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendedores e donos de empresa cadastram clientes, salvam a reunião inteira (planta, fachada, ROI, Conectividade, logo) num cliente e reabrem depois; o dono vê todos, transfere, exclui e exporta CSV pro CRM.

**Architecture:** Tabela `clients` com RLS por empresa (vendedor: próprios; dono: todos) atrás de `current_profile()`; a reunião é um JSON versionado do estado das três stores (zustand), gravado só pela RPC `save_client_meeting`; logo do cliente vai pro bucket privado `client-logos` ao salvar. No front, um módulo puro captura/aplica o estado, uma store guarda o cliente "ligado" à tela e o retrato do último salvar/abrir (pra avisar trabalho não salvo).

**Tech Stack:** React 19 + Vite + TS, zustand, `@supabase/supabase-js`, Supabase Postgres/RLS/Storage, vitest + Testing Library, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-19-clientes-reunioes-design.md`

## Global Constraints

- Só `role = 'empresa'` (dono e vendedores) usa; cliente físico e admin são negados pelo servidor; ADMIN não vê clientes na tela.
- Campos: nome (obrigatório), telefone, email, CNPJ (opcional, dígitos verificadores), tem ponto (bool), endereço, tamanho do ponto m², observações. Telefone **ou** email obrigatório. Sem CPF do cliente.
- Uma reunião por cliente; salvar de novo sobrescreve.
- Vendedor vê/edita/exclui só os próprios; dono vê/edita/exclui/transfere todos da empresa; só o responsável salva a reunião.
- Exclusão definitiva, leva a logo, auditada em `admin_actions_log` só com o id (`client_deleted`).
- Duplicado (mesmo CNPJ ou telefone na empresa): aviso `Este cliente já está com <nome>.` — não bloqueia; não revela outros dados.
- Logo: reduz pra no máximo 1000 px de largura/altura, WebP com transparência; se o navegador não gerar WebP, PNG reduzido. Bucket `client-logos` privado, 2 MB, `image/webp` e `image/png`, caminho `<company_id>/<client_id>/logo`.
- CSV: separador `;`, BOM UTF-8, CRLF; colunas: Nome;Telefone;Email;CNPJ;Tem ponto;Endereço;Tamanho (m²);Observações;Vendedor;Criado em;Atualizado em;Área da planta (m²);Máquinas;Investimento (R$);Retorno (meses).
- Mensagem ao abrir com trabalho não salvo: `A tela tem alterações que não foram salvas. Abrir esta reunião vai substituí-las.` com botões "Abrir mesmo assim" e "Cancelar" (sem `window.confirm`).
- Máquina do snapshot que não existe mais no catálogo: abre sem ela e mostra `Algumas máquinas desta reunião não estão mais no catálogo e foram retiradas: <nomes/ids>.`
- Migration nova: `supabase/migrations/0009_clients.sql`.

## Review Focus

- Snapshot salvo por versão antiga do app (campos faltando) abre sem quebrar, completando com o padrão — teste em Task 3 (`applyMeeting` com objeto parcial).
- Telefone/CNPJ digitado com máscara é o mesmo pra duplicado e unicidade de aviso — teste em Task 1 (`client_duplicate_owner` com máscara) e Task 4.
- Vendedor revogado: dono ainda lista e transfere os clientes dele — pgTAP em Task 1.
- Excel BR: nomes com acento e `;`/aspas/quebra de linha nas observações não quebram colunas — teste em Task 5 (`toCsv`).
- Logo PNG grande (4000 px) fica ≤ 1000 px; navegador sem WebP cai em PNG — teste em Task 2 com canvas falso.

---

### Task 1: Banco — tabela `clients`, RLS, RPCs, bucket

**Files:** Create `supabase/migrations/0009_clients.sql`, `supabase/tests/clients.test.sql`.

**Interfaces — Produces (SQL):**
- `clients(id uuid pk default gen_random_uuid(), company_id uuid not null → companies on delete cascade, seller_id uuid not null → profiles, name text not null check (btrim(name) <> ''), phone text check (phone ~ '^[0-9]{10,11}$'), email text, cnpj text check (cnpj is null or is_valid_cnpj(cnpj)), has_location boolean not null default false, address text, location_m2 numeric check (location_m2 > 0), notes text, meeting jsonb, meeting_saved_at timestamptz, logo_path text, created_at, updated_at)`; check `phone is not null or nullif(btrim(email), '') is not null`; índices em `(company_id)`, `(company_id, cnpj)`, `(company_id, phone)`.
- `public.is_valid_cnpj(p text) returns boolean` (com ou sem máscara; recusa dígitos iguais).
- RLS (todas exigem `current_profile().role = 'empresa'` e `company_id = cp.company_id`): select se `cp.is_owner or seller_id = auth.uid()`; insert com `seller_id = auth.uid()`; update/delete se `cp.is_owner or seller_id = auth.uid()`.
- Privilégios por coluna: `revoke update on clients from authenticated; grant update (name, phone, email, cnpj, has_location, address, location_m2, notes, seller_id) on clients to authenticated` (meeting/logo só via RPC).
- Trigger `clients_guard` (before update): `seller_id` só muda se quem chama é dono e o novo responsável é perfil ativo, `role='empresa'`, mesma empresa (senão `42501`); `company_id` nunca muda; atualiza `updated_at`. Normaliza `phone`/`cnpj` pra dígitos no insert/update (before insert or update).
- Trigger after delete → `admin_actions_log(actor_id=auth.uid(), action='client_deleted', details={id, company_id})`.
- `public.save_client_meeting(p_client uuid, p_meeting jsonb, p_logo_path text) returns void` — security definer; exige `session_is_current()`, cliente da empresa do chamador com `seller_id = auth.uid()`, `p_logo_path` nulo ou igual a `<company_id>/<client_id>/logo`; grava `meeting`, `meeting_saved_at = now()`, `logo_path`. Senão `42501`. `p_meeting` até 200 KB (`22023 meeting_too_large`).
- `public.client_duplicate_owner(p_cnpj text, p_phone text, p_exclude uuid) returns text` — security definer; na empresa do chamador (via `current_profile()`), primeiro cliente (≠ `p_exclude`) com mesmo CNPJ ou telefone (comparando só dígitos); devolve `full_name` do responsável (ou `'você'` se for o próprio), senão null.
- Bucket `client-logos` (privado, 2097152, `{image/webp,image/png}`); policies em `storage.objects`: select se o cliente da pasta (`(storage.foldername(name))[2]::uuid`) é visível pelo chamador (subselect em `clients` sob RLS); insert/update se o chamador é o responsável desse cliente e `name = company/client/logo`; delete se pode excluir o cliente.

- [ ] **Step 1:** Escrever `clients.test.sql` (dono A, vendedores A1 e A2, vendedor B de outra empresa, cliente físico; sessões em `user_sessions`, cadastro completo, claims com `session_id`) com: A1 insere cliente (lives_ok) e lê 1; A2 lê 0 do A1; dono lê todos de A; B lê 0; cliente físico insert → 42501; insert sem telefone e sem email → 23514; CNPJ inválido → 23514; telefone `'(11) 98765-4321'` grava `'11987654321'`; A1 `update clients set meeting = '{}'` → 42501 (privilégio de coluna); A1 `save_client_meeting` lives_ok e `meeting_saved_at` preenchido; dono `save_client_meeting` no cliente de A1 → 42501; A1 tenta trocar `seller_id` → 42501; dono transfere pra A2 (lives_ok) e A2 passa a ler; após revogar A2 (superuser `active=false`), dono ainda lê e transfere de volta pra A1; transferir pra B → 42501; `client_duplicate_owner('11.222.333/0001-81', null, null)` como A2 devolve nome de A1 quando A1 tem esse CNPJ, e `'você'` pro próprio; como B devolve null; delete pelo dono grava `client_deleted` sem `name` em `details`; storage: A1 insere `<A>/<cliente>/logo` lives_ok, A2 insere na pasta do cliente de A1 → 42501, dono lê o objeto, A2 lê 0.
- [ ] **Step 2:** `npx -y supabase@3.1.0 db reset && npx -y supabase@3.1.0 test db` — Expected: FAIL em `clients.test.sql`.
- [ ] **Step 3:** Escrever `0009_clients.sql` conforme Interfaces (funções `security definer set search_path = ''`, revoke public/anon, grant authenticated).
- [ ] **Step 4:** Mesmo comando — Expected: PASS em todos os arquivos.
- [ ] **Step 5:** Commit `feat(db): clients table with per-company RLS, meeting RPC, duplicate check and logo bucket`.

### Task 2: Logo leve (redução + WebP)

**Files:** Create `app/src/lib/logoImage.ts`, `app/src/lib/logoImage.test.ts`; Modify `app/src/ui/LogoUpload.tsx` (+ test).

**Interfaces — Produces:**
```ts
export const LOGO_MAX_SIDE = 1000;
export async function shrinkLogo(file: File): Promise<string>; // data URL "image/webp" (ou "image/png" se o navegador não gerar webp); sem canvas/createImageBitmap devolve o PNG original
export function dataUrlToBlob(dataUrl: string): Blob;
export async function blobToDataUrl(blob: Blob): Promise<string>;
```
- [ ] **Step 1:** Testes com `createImageBitmap` e `HTMLCanvasElement.prototype.toBlob/getContext` falsos: imagem 4000×2000 → canvas 1000×500 e `toBlob` chamado com `"image/webp"`; quando o blob volta com `type "image/png"` (Safari), resultado começa com `data:image/png`; imagem 800×600 não é ampliada; sem `createImageBitmap` devolve o data URL original; `dataUrlToBlob` ida e volta preserva bytes e tipo. `LogoUpload.test`: upload PNG válido chama `shrinkLogo` e grava o resultado em `logoDataUrl`.
- [ ] **Step 2:** `cd app && npx vitest run src/lib/logoImage.test.ts src/ui/LogoUpload.test.tsx` — Expected: FAIL.
- [ ] **Step 3:** Implementar; `LogoUpload` mantém a checagem de assinatura PNG (`readPngAsDataUrl`) e depois `shrinkLogo(file)`.
- [ ] **Step 4:** Mesmo comando + `npx vitest run` — Expected: PASS.
- [ ] **Step 5:** Commit `feat: shrink facade logo to 1000px WebP with transparency`.

### Task 3: Capturar e reaplicar a reunião

**Files:** Create `app/src/clients/meeting.ts`, `app/src/clients/meeting.test.ts`, `app/src/clients/sessionStore.ts`; Modify `app/src/roi/roiStore.ts`, `app/src/insights/insightsStore.ts` (ação `replaceAll`).

**Interfaces — Produces:**
```ts
// meeting.ts
export const MEETING_VERSION = 1;
export interface MeetingSnapshot { v: 1; project: ProjectState & FacadeState; roi: RoiState; insights: InsightsInputs }
export type FacadeState = { logoStyle; logoDepthMm; logoSideColor; facadeVisible; facadeColor; facadeSignColor }; // tipos da projectStore
export function captureMeeting(): MeetingSnapshot;            // lê as 3 stores; nunca inclui logoDataUrl
export function applyMeeting(raw: unknown, catalogIds: string[], logoDataUrl: string | null): { removed: string[] }; // completa campos faltantes com o padrão; descarta máquinas fora do catálogo
export function meetingFingerprint(): string;                  // JSON.stringify(captureMeeting()) + logoDataUrl
// sessionStore.ts (zustand)
export interface MeetingSession { clientId: string | null; clientName: string | null; canSave: boolean; baseline: string; bind(c: { id: string; name: string; canSave: boolean }): void; markSaved(): void; unbind(): void; isDirty(): boolean }
// roiStore / insightsStore
replaceAll(state: RoiState | InsightsInputs): void; // substitui e persiste no localStorage
```
- [ ] **Step 1:** Testes: capture → mexe nas stores → apply devolve exatamente o capturado; `applyMeeting({ v: 1, project: { roomWidthMm: 5000 } }, ids, null)` não lança e completa o resto com o padrão; máquina `"sumiu"` volta em `removed` e não entra em `machines`; `logoDataUrl` aplicado vai pra store; `isDirty()` false logo após `bind`/`markSaved`, true depois de mudar `roomWidthMm`, true após mudar só a logo.
- [ ] **Step 2:** `cd app && npx vitest run src/clients` — Expected: FAIL.
- [ ] **Step 3:** Implementar. Baseline inicial = `meetingFingerprint()` na criação da store (tela recém-aberta não conta como alterada).
- [ ] **Step 4:** Mesmo + suíte inteira — Expected: PASS.
- [ ] **Step 5:** Commit `feat: capture and restore the whole meeting state`.

### Task 4: API de clientes

**Files:** Create `app/src/clients/api.ts`, `app/src/clients/api.test.ts`, `app/src/lib/cnpj.ts` (+ test).

**Interfaces — Produces:**
```ts
// cnpj.ts
export function normalizeCnpj(v: string): string; export function isValidCnpj(v: string): boolean; export function formatCnpj(v: string): string;
// api.ts
export interface ClientInput { name: string; phone: string; email: string; cnpj: string; hasLocation: boolean; address: string; locationM2: string; notes: string }
export interface Client extends ClientInput { id: string; sellerId: string; sellerName: string | null; meeting: unknown | null; meetingSavedAt: string | null; logoPath: string | null; createdAt: string; updatedAt: string }
export function clientInputProblem(i: ClientInput): string | null; // "Digite o nome do cliente." | "Informe telefone ou email." | "Telefone inválido. Use DDD + número." | "CNPJ inválido." | "Tamanho do ponto inválido."
export async function listClients(): Promise<Client[]>;                       // select com join profiles(full_name) via seller_id
export async function createClient(i: ClientInput, companyId: string, sellerId: string): Promise<Client>;
export async function updateClient(id: string, i: ClientInput): Promise<void>;
export async function transferClient(id: string, sellerId: string): Promise<void>;
export async function deleteClient(c: Client): Promise<void>;                 // remove logo do storage (se houver) e a linha
export async function duplicateOwner(i: ClientInput, excludeId: string | null): Promise<string | null>;
export async function saveMeeting(c: Client, companyId: string, logoDataUrl: string | null): Promise<void>; // sobe logo em <company>/<client>/logo (upsert) e chama save_client_meeting com captureMeeting()
export async function loadMeetingLogo(c: Client): Promise<string | null>;     // baixa e devolve data URL
```
- [ ] **Step 1:** Testes: `isValidCnpj('11.222.333/0001-81')` true, `'11.111.111/1111-11'` false; `clientInputProblem` cobre cada mensagem e aceita só email; `createClient` envia telefone/CNPJ só com dígitos e `location_m2` número ou null; `saveMeeting` sobe a logo antes do RPC com o caminho `c1/cl1/logo` e `contentType` do data URL, e sem logo chama o RPC com `p_logo_path: null`; `deleteClient` remove o arquivo antes da linha; `duplicateOwner` passa dígitos e devolve o nome.
- [ ] **Step 2:** `cd app && npx vitest run src/clients/api.test.ts src/lib/cnpj.test.ts` — Expected: FAIL.
- [ ] **Step 3:** Implementar (erros viram mensagens fixas amigáveis; nunca `error.message`).
- [ ] **Step 4:** Mesmo + suíte — Expected: PASS.
- [ ] **Step 5:** Commit `feat: clients API (CRUD, transfer, duplicate check, meeting save/load)`.

### Task 5: Tela "Clientes" e CSV

**Files:** Create `app/src/clients/csv.ts` (+ test), `app/src/ui/ClientsPanel.tsx` (+ test), `app/src/ui/MeetingBar.tsx` (+ test); Modify `app/src/App.tsx` (+ `App.test.tsx`).

**Interfaces — Produces:**
```ts
export function toCsv(clients: Client[], catalog: CatalogMachine[]): string; // regras do Global Constraints; resumo via computeRoi(meeting.roi): investimento total e payback em meses
export function ClientsPanel(props: { onClose?: () => void }): JSX.Element;
export function MeetingBar(): JSX.Element | null; // "Reunião de <nome>" + Salvar reunião (desativado com "Só o vendedor responsável salva esta reunião." quando !canSave) + Fechar
```
- [ ] **Step 1:** Testes:
  - `toCsv`: começa com `﻿`, cabeçalho exato, `;` como separador, CRLF; campo com `;`, `"` ou quebra de linha vai entre aspas com aspas dobradas; "Tem ponto" = `Sim`/`Não`; cliente sem reunião deixa as 4 colunas de resumo vazias.
  - `ClientsPanel` (vendedor): lista os próprios; "Novo cliente" com erro "Informe telefone ou email." sem contato; ao digitar CNPJ de colega mostra `Este cliente já está com Carla.` e ainda deixa salvar; "Salvar reunião" num cliente chama `saveMeeting` e liga a tela (`bind`); "Abrir reunião" com tela alterada mostra o aviso exato e só aplica após "Abrir mesmo assim"; abre com máquina removida e mostra o aviso de máquinas retiradas; não mostra "Baixar planilha" nem "Transferir".
  - `ClientsPanel` (dono): vê coluna Vendedor; "Baixar planilha (CSV)" gera download `clientes-<data>.csv`; "Transferir" com select de membros ativos chama `transferClient`; "Excluir" pede confirmação inline e chama `deleteClient`.
  - `MeetingBar`: some sem cliente ligado; dono vendo reunião de vendedor tem botão desativado com a frase exata.
  - `App.test`: botão "Clientes" só pra `empresa`.
- [ ] **Step 2:** `cd app && npx vitest run src/clients/csv.test.ts src/ui/ClientsPanel.test.tsx src/ui/MeetingBar.test.tsx src/App.test.tsx` — Expected: FAIL.
- [ ] **Step 3:** Implementar; lista de membros ativos via `listCompanyMembers()` existente; download via `Blob` + `URL.createObjectURL` + `<a download>`.
- [ ] **Step 4:** Mesmo + suíte + `npx tsc -b` — Expected: PASS.
- [ ] **Step 5:** Commit `feat: clients screen, saved meetings and CSV export`.

### Task 6: Verificação ponta a ponta local

- [ ] **Step 1:** E2E com `supabase-js` no Supabase local (dono, 2 vendedores, outra empresa): vendedor cria cliente, salva reunião com logo, colega não vê, dono vê/lê a logo, outra empresa não vê, duplicado devolve nome, dono transfere e exclui (logo some do bucket). Expected: todas PASS.
- [ ] **Step 2:** `cd app && npx vitest run && npx tsc -b && npm run build` e `npx -y supabase@3.1.0 test db` — Expected: verde.
- [ ] **Step 3:** Publicar na nuvem só com autorização explícita do usuário.
