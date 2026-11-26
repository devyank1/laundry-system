# Diário de Obra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba "Diário de Obra" com as 25 etapas da obra do cliente, concluídas em ordem, salvas na reunião.

**Architecture:** Lista fixa de etapas (`obra/steps.ts`), store zustand persistida em localStorage (`obra/obraStore.ts`) com `doneAt: string[]` (data ISO da etapa i, em ordem), capturada/aplicada pelo snapshot da reunião (`clients/meeting.ts`), tela `ui/DiarioObra.tsx` numa aba nova do `App`.

**Tech Stack:** React 19, zustand, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-25-diario-de-obra-design.md`

## Global Constraints

- 25 etapas (0–24) na ordem da planilha, grafia corrigida.
- Rótulos: aba `Diário de Obra`; botões `Concluir etapa` e `Desfazer`; progresso `N de 25 etapas concluídas`.
- localStorage `lavanderia.obra.v1`; snapshot da reunião ganha `obra: { doneAt: string[] }` (opcional; ausente = zerado). `MEETING_VERSION` continua 1.
- Sair da conta limpa o diário (`resetWorkspace`).

## Review Focus

- Snapshot antigo sem `obra` abre zerado — teste em Task 2.
- `doneAt` com lixo (não-array, datas inválidas, mais de 25) é saneado — teste em Task 1.
- Concluir a última etapa (24) não estoura — teste em Task 1.
- Desfazer com nada concluído não faz nada — teste em Task 1.
- Marcar etapa deixa a reunião "não salva" (aviso ao abrir outra) — teste em Task 2.

---

### Task 1: Etapas e store

**Files:** Create `app/src/obra/steps.ts`, `app/src/obra/obraStore.ts`, `app/src/obra/obraStore.test.ts`.

**Produces:**
```ts
export interface ObraStep { n: number; title: string; goal?: string; deadline?: string; image?: string }
export const OBRA_STEPS: ObraStep[]; // 25 itens
export interface ObraState { doneAt: string[] }
export function normalizeObra(raw: unknown): ObraState;
export const useObraStore: { doneAt; complete(now?: Date): void; undo(): void; reset(): void; replaceAll(s: ObraState): void };
```
- [ ] Testes: 25 etapas, n 0..24, primeira "Prazos", última "Inauguração"; `complete` adiciona data e persiste; 26ª conclusão ignorada; `undo` remove a última e não faz nada vazio; `normalizeObra` descarta não-array, não-datas e corta em 25.
- [ ] Implementar; rodar `npx vitest run src/obra`; commit.

### Task 2: Reunião e limpeza

**Files:** Modify `app/src/clients/meeting.ts`, `app/src/clients/resetWorkspace.ts`; tests em `meeting.test.ts`, `resetWorkspace.test.ts`.
- [ ] Testes: capture inclui `obra.doneAt`; apply de snapshot sem `obra` zera; `isDirty()` vira true após `complete()`; `resetWorkspace` zera o diário.
- [ ] Implementar; suíte; commit.

### Task 3: Tela e aba

**Files:** Create `app/src/ui/DiarioObra.tsx` (+ test); Modify `app/src/App.tsx` (+ test), CSS.
- [ ] Testes: mostra `0 de 25 etapas concluídas` e `Concluir etapa` só na etapa atual; clicar marca "concluída em dd/mm/aaaa" e avança; `Desfazer` só na última concluída; App tem botão de aba `Diário de Obra` que abre a tela.
- [ ] Implementar; suíte + `tsc -b` + build; commit.
