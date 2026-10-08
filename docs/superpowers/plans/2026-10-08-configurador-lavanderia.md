# Configurador de Lavanderia (Planta 2D/3D Paramétrica) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um SPA React que calcula automaticamente o layout de uma lavanderia de autoatendimento a partir de parâmetros do cliente (dimensões, maquinário, porta, lado de acesso técnico, mobiliário), respeitando regras técnicas fixas, e gera planta 2D (download PNG/PDF) e planta 3D navegável (download PNG).

**Architecture:** Motor de layout puro (`engine/`) sem dependência de React/Three, 100% testável por unidade, consumido por um hook (`useLayout`) que combina estado Zustand (`projectStore`) + catálogo editável (`catalog/store`, persistido em `localStorage`). Dois viewers (SVG 2D e React-Three-Fiber 3D) renderizam a partir do mesmo objeto `Layout` — nunca divergem. Sem backend.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand, Three.js via `@react-three/fiber` + `@react-three/drei`, `jspdf` para export PDF, Vitest + Testing Library para testes.

**Spec:** `docs/superpowers/specs/2026-10-08-configurador-lavanderia-design.md`

## Global Constraints

- Projeto React vive em `app/` (subpasta) — os PDFs/XLSX de origem ficam na raiz do repositório, fora do código.
- Motor (`engine/`) trabalha inteiramente em milímetros (mm); a UI converte para metros só na exibição.
- Sem backend — 100% client-side; catálogo e preferências persistem via `localStorage`.
- `LATERAL_CLEARANCE_MM = 500` — folga lateral mínima, parede até maquinário, cada lado.
- `TECH_AREA_DEFAULT_MM = 1050` (faixa válida 1000–1100mm) — área técnica traseira.
- `DRYWALL_THICKNESS_MM = 100` — drywall coplanar à frente da máquina, com essa espessura.
- `CEILING_CLEARANCE_MM = 300` — folga acima da máquina mais alta (duto/manutenção).
- `SALON_MIN_DEPTH_MM = 1800` — profundidade mínima de salão para mesa+3 cadeiras+totem.
- `MACHINE_GAP_MM = 20` — espaço entre máquinas na fileira.
- `DOOR_WIDTH_MM = 900` — largura do vão da porta frontal opcional, centralizada na parede da frente.
- Fórmula de BTU: `area_m2 * 600 + qtdSecadoras * 2000`, arredondado para cima para o tamanho comercial mais próximo em `[9000, 12000, 18000, 22000, 30000, 36000, 48000, 60000]`.
- Catálogo seed (3 máquinas, ver spec seção 2.1): `sq-stack` (683×794×1986mm), `mamute-smart10` (680×880×2040mm), `mamute-smart17` (835×1190×2210mm).
- Totem: `{ width: 450, depth: 450, height: 1100 }` mm — fica no salão, encostado na linha do drywall, dentro da faixa de 50cm do lado de acesso técnico escolhido.

---

## Task 1: Scaffold do projeto Vite + testes

**Files:**
- Create: `app/` (gerado pelo Vite, template react-ts)
- Modify: `app/vite.config.ts`
- Create: `app/src/setupTests.ts`
- Modify: `app/package.json`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: projeto buildável com `npm run dev`, `npm run build`, `npm test` (vitest) funcionando — base para todas as tasks seguintes.

- [ ] **Step 1: Criar o projeto Vite**

Rodar na raiz do repositório:

```bash
npm create vite@latest app -- --template react-ts
cd app
npm install
```

- [ ] **Step 2: Instalar dependências de produção**

```bash
npm install three @react-three/fiber @react-three/drei zustand jspdf
```

- [ ] **Step 3: Instalar dependências de teste**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/three
```

- [ ] **Step 4: Configurar Vitest no `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    globals: true,
  },
});
```

- [ ] **Step 5: Criar `src/setupTests.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Adicionar script de teste no `package.json`**

Em `app/package.json`, dentro de `"scripts"`, adicionar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Verificar que o projeto builda e os testes rodam (vazio)**

Run: `cd app && npm run build && npm test`
Expected: build conclui sem erro; `npm test` reporta "No test files found" (ainda sem testes) sem crashar.

- [ ] **Step 8: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/
git commit -m "chore: scaffold do projeto Vite + React + TS + Vitest"
```

---

## Task 2: Engine — tipos e constantes

**Files:**
- Create: `app/src/engine/types.ts`
- Create: `app/src/engine/constants.ts`
- Test: `app/src/engine/constants.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: tipos `CatalogMachine`, `MachineSelection`, `TechAccessSide`, `ProjectState`, `PlacedMachine`, `Rect`, `FurnitureLayout`, `DrywallOpening`, `Layout` (inclui `frontDoor: Rect | null`), `Violation`, `ViolationCode`, `LayoutResult`; constantes `LATERAL_CLEARANCE_MM`, `MACHINE_GAP_MM`, `TECH_AREA_MIN_MM`, `TECH_AREA_MAX_MM`, `TECH_AREA_DEFAULT_MM`, `DRYWALL_THICKNESS_MM`, `SALON_MIN_DEPTH_MM`, `CEILING_CLEARANCE_MM`, `TOTEM_SIZE_MM`, `DOOR_WIDTH_MM`, `AC_SIZES_BTU`. Usados por todas as tasks de `engine/`, `catalog/`, `state/`, `viewer2d/`, `viewer3d/`.

- [ ] **Step 1: Escrever `app/src/engine/types.ts`**

```ts
export type MachineType = "lavadora" | "secadora" | "stack";

export interface CatalogMachine {
  id: string;
  brand: string;
  model: string;
  type: MachineType;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  breakerLavadoraA?: number;
  breakerSecadoraA?: number;
  cableMm2?: string;
  exhaustDiameterMm?: number;
  drainInch?: string;
  drainLpm?: number;
  weightKg?: number;
}

export interface MachineSelection {
  catalogId: string;
  qty: number;
}

export type TechAccessSide = "left" | "right";

export interface ProjectState {
  roomWidthMm: number;
  roomDepthMm: number;
  ceilingHeightMm: number;
  machines: MachineSelection[];
  doorEnabled: boolean;
  techAccessSide: TechAccessSide;
  furnitureEnabled: boolean;
  acOverrideBTU: number | null;
}

export interface PlacedMachine {
  catalogId: string;
  instanceIndex: number;
  x: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DrywallOpening = Rect;

export interface FurnitureLayout {
  table: Rect;
  chairs: Rect[];
  totem: Rect;
  ac: Rect;
}

export interface Layout {
  machines: PlacedMachine[];
  drywall: { y: number; openings: DrywallOpening[]; heightMm: number };
  techCorridor: Rect;
  frontDoor: Rect | null;
  furniture: FurnitureLayout | null;
  acSuggestedBTU: number;
  roomWidthMm: number;
  roomDepthMm: number;
  ceilingHeightMm: number;
}

export type ViolationCode =
  | "NO_MACHINES"
  | "WIDTH_TOO_SMALL"
  | "DEPTH_TOO_SMALL"
  | "CEILING_TOO_LOW";

export interface Violation {
  code: ViolationCode;
  message: string;
  field: keyof ProjectState;
  suggestedValueMm: number;
}

export interface LayoutResult {
  layout: Layout | null;
  violations: Violation[];
}
```

- [ ] **Step 2: Escrever `app/src/engine/constants.ts`**

```ts
export const LATERAL_CLEARANCE_MM = 500;
export const MACHINE_GAP_MM = 20;
export const TECH_AREA_MIN_MM = 1000;
export const TECH_AREA_MAX_MM = 1100;
export const TECH_AREA_DEFAULT_MM = 1050;
export const DRYWALL_THICKNESS_MM = 100;
export const SALON_MIN_DEPTH_MM = 1800;
export const CEILING_CLEARANCE_MM = 300;

export const TOTEM_SIZE_MM = { width: 450, depth: 450, height: 1100 };

export const DOOR_WIDTH_MM = 900;

export const AC_SIZES_BTU = [9000, 12000, 18000, 22000, 30000, 36000, 48000, 60000];
```

- [ ] **Step 3: Escrever o teste de sanidade das constantes**

```ts
import { describe, expect, it } from "vitest";
import {
  LATERAL_CLEARANCE_MM,
  TECH_AREA_DEFAULT_MM,
  TECH_AREA_MIN_MM,
  TECH_AREA_MAX_MM,
  AC_SIZES_BTU,
} from "./constants";

describe("engine constants", () => {
  it("mantém a área técnica padrão dentro da faixa 1000-1100mm", () => {
    expect(TECH_AREA_DEFAULT_MM).toBeGreaterThanOrEqual(TECH_AREA_MIN_MM);
    expect(TECH_AREA_DEFAULT_MM).toBeLessThanOrEqual(TECH_AREA_MAX_MM);
  });

  it("mantém a folga lateral em 500mm (50cm)", () => {
    expect(LATERAL_CLEARANCE_MM).toBe(500);
  });

  it("lista tamanhos comerciais de BTU em ordem crescente", () => {
    const sorted = [...AC_SIZES_BTU].sort((a, b) => a - b);
    expect(AC_SIZES_BTU).toEqual(sorted);
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd app && npx vitest run src/engine/constants.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/engine/types.ts app/src/engine/constants.ts app/src/engine/constants.test.ts
git commit -m "feat(engine): tipos e constantes do motor de layout"
```

---

## Task 3: Engine — validação de restrições (constraints)

**Files:**
- Create: `app/src/engine/constraints.ts`
- Test: `app/src/engine/constraints.test.ts`

**Interfaces:**
- Consumes: tipos de `./types` (`ProjectState`, `CatalogMachine`, `Violation`), constantes de `./constants`.
- Produces: `resolveSelection(selections, catalog): { machine: CatalogMachine; qty: number }[]`, `flattenSelection(resolved): CatalogMachine[]`, `machineRowWidthMm(list): number`, `computeMinWidthMm(list): number`, `computeMinDepthMm(list): number`, `computeMinCeilingMm(list): number`, `countDryers(resolved): number`, `validate(state, catalog): Violation[]` — usados pela Task 5 (`layout.ts`) e pela Task 4 (`btu.ts` usa `countDryers`).

- [ ] **Step 1: Escrever o teste de `computeMinWidthMm`/`computeMinDepthMm`/`computeMinCeilingMm`**

```ts
import { describe, expect, it } from "vitest";
import {
  computeMinWidthMm,
  computeMinDepthMm,
  computeMinCeilingMm,
  machineRowWidthMm,
} from "./constraints";
import type { CatalogMachine } from "./types";

const stack: CatalogMachine = {
  id: "sq-stack",
  brand: "Speed Queen",
  model: "Stack",
  type: "stack",
  widthMm: 683,
  depthMm: 794,
  heightMm: 1986,
};

describe("constraints — cálculo de mínimos", () => {
  it("calcula a largura da fileira somando larguras + gaps entre máquinas", () => {
    const list = [stack, stack, stack];
    expect(machineRowWidthMm(list)).toBe(683 * 3 + 20 * 2);
  });

  it("largura mínima da sala = fileira + 500mm de cada lado", () => {
    const list = [stack, stack, stack];
    const rowWidth = machineRowWidthMm(list);
    expect(computeMinWidthMm(list)).toBe(rowWidth + 500 + 500);
  });

  it("profundidade mínima = área técnica + máquina mais funda + drywall + salão mínimo", () => {
    const list = [stack];
    expect(computeMinDepthMm(list)).toBe(1050 + 794 + 100 + 1800);
  });

  it("pé-direito mínimo = máquina mais alta + 300mm de folga", () => {
    const list = [stack];
    expect(computeMinCeilingMm(list)).toBe(1986 + 300);
  });

  it("lista vazia retorna zero em todos os mínimos", () => {
    expect(machineRowWidthMm([])).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha (funções ainda não existem)**

Run: `cd app && npx vitest run src/engine/constraints.test.ts`
Expected: FAIL com "Cannot find module './constraints'" ou similar.

- [ ] **Step 3: Implementar `app/src/engine/constraints.ts` (parte 1 — cálculo de mínimos)**

```ts
import {
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  TECH_AREA_DEFAULT_MM,
  DRYWALL_THICKNESS_MM,
  SALON_MIN_DEPTH_MM,
  CEILING_CLEARANCE_MM,
} from "./constants";
import type { CatalogMachine, MachineSelection, ProjectState, Violation } from "./types";

export function resolveSelection(
  selections: MachineSelection[],
  catalog: CatalogMachine[]
): { machine: CatalogMachine; qty: number }[] {
  return selections
    .map((s) => ({ machine: catalog.find((m) => m.id === s.catalogId), qty: s.qty }))
    .filter(
      (r): r is { machine: CatalogMachine; qty: number } => !!r.machine && r.qty > 0
    );
}

export function flattenSelection(
  resolved: { machine: CatalogMachine; qty: number }[]
): CatalogMachine[] {
  const list: CatalogMachine[] = [];
  for (const r of resolved) {
    for (let i = 0; i < r.qty; i++) list.push(r.machine);
  }
  return list;
}

export function machineRowWidthMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  const widths = list.reduce((sum, m) => sum + m.widthMm, 0);
  return widths + (list.length - 1) * MACHINE_GAP_MM;
}

export function computeMinWidthMm(list: CatalogMachine[]): number {
  return machineRowWidthMm(list) + LATERAL_CLEARANCE_MM * 2;
}

export function computeMinDepthMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  const maxDepth = Math.max(...list.map((m) => m.depthMm));
  return TECH_AREA_DEFAULT_MM + maxDepth + DRYWALL_THICKNESS_MM + SALON_MIN_DEPTH_MM;
}

export function computeMinCeilingMm(list: CatalogMachine[]): number {
  if (list.length === 0) return 0;
  const maxHeight = Math.max(...list.map((m) => m.heightMm));
  return maxHeight + CEILING_CLEARANCE_MM;
}

export function countDryers(resolved: { machine: CatalogMachine; qty: number }[]): number {
  return resolved
    .filter((r) => r.machine.type === "secadora" || r.machine.type === "stack")
    .reduce((sum, r) => sum + r.qty, 0);
}
```

- [ ] **Step 4: Rodar e confirmar que o teste do Step 1 passa**

Run: `cd app && npx vitest run src/engine/constraints.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Escrever o teste de `validate`**

```ts
import { describe, expect, it } from "vitest";
import { validate } from "./constraints";
import type { CatalogMachine, ProjectState } from "./types";

const catalog: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
  },
];

const baseState: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 4200,
  ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 1 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  acOverrideBTU: null,
};

describe("validate", () => {
  it("retorna NO_MACHINES quando nenhuma máquina está selecionada", () => {
    const violations = validate({ ...baseState, machines: [] }, catalog);
    expect(violations).toEqual([
      expect.objectContaining({ code: "NO_MACHINES", field: "machines" }),
    ]);
  });

  it("retorna vazio quando a sala atende a todos os mínimos", () => {
    const violations = validate(baseState, catalog);
    expect(violations).toEqual([]);
  });

  it("retorna WIDTH_TOO_SMALL com o valor mínimo sugerido", () => {
    const violations = validate({ ...baseState, roomWidthMm: 1000 }, catalog);
    expect(violations).toEqual([
      expect.objectContaining({
        code: "WIDTH_TOO_SMALL",
        field: "roomWidthMm",
        suggestedValueMm: 683 + 500 + 500,
      }),
    ]);
  });

  it("retorna DEPTH_TOO_SMALL com o valor mínimo sugerido", () => {
    const violations = validate({ ...baseState, roomDepthMm: 1000 }, catalog);
    expect(violations).toEqual([
      expect.objectContaining({
        code: "DEPTH_TOO_SMALL",
        field: "roomDepthMm",
        suggestedValueMm: 1050 + 794 + 100 + 1800,
      }),
    ]);
  });

  it("retorna CEILING_TOO_LOW com o valor mínimo sugerido", () => {
    const violations = validate({ ...baseState, ceilingHeightMm: 1000 }, catalog);
    expect(violations).toEqual([
      expect.objectContaining({
        code: "CEILING_TOO_LOW",
        field: "ceilingHeightMm",
        suggestedValueMm: 1986 + 300,
      }),
    ]);
  });
});
```

- [ ] **Step 6: Rodar e confirmar falha (`validate` ainda não existe)**

Run: `cd app && npx vitest run src/engine/constraints.test.ts`
Expected: FAIL — "validate is not exported" / `undefined is not a function`.

- [ ] **Step 7: Implementar `validate` (anexar ao final de `constraints.ts`)**

```ts
export function validate(state: ProjectState, catalog: CatalogMachine[]): Violation[] {
  const resolved = resolveSelection(state.machines, catalog);
  const list = flattenSelection(resolved);

  if (list.length === 0) {
    return [
      {
        code: "NO_MACHINES",
        message: "Selecione ao menos uma máquina no catálogo.",
        field: "machines",
        suggestedValueMm: 0,
      },
    ];
  }

  const violations: Violation[] = [];

  const minWidth = computeMinWidthMm(list);
  if (state.roomWidthMm < minWidth) {
    violations.push({
      code: "WIDTH_TOO_SMALL",
      message: `Largura insuficiente para o maquinário escolhido. Mínimo: ${(minWidth / 1000).toFixed(2)}m.`,
      field: "roomWidthMm",
      suggestedValueMm: minWidth,
    });
  }

  const minDepth = computeMinDepthMm(list);
  if (state.roomDepthMm < minDepth) {
    violations.push({
      code: "DEPTH_TOO_SMALL",
      message: `Profundidade insuficiente para área técnica, maquinário e salão. Mínimo: ${(minDepth / 1000).toFixed(2)}m.`,
      field: "roomDepthMm",
      suggestedValueMm: minDepth,
    });
  }

  const minCeiling = computeMinCeilingMm(list);
  if (state.ceilingHeightMm < minCeiling) {
    violations.push({
      code: "CEILING_TOO_LOW",
      message: `Pé-direito insuficiente para a máquina mais alta + folga de duto. Mínimo: ${(minCeiling / 1000).toFixed(2)}m.`,
      field: "ceilingHeightMm",
      suggestedValueMm: minCeiling,
    });
  }

  return violations;
}
```

- [ ] **Step 8: Rodar todos os testes do arquivo e confirmar que passam**

Run: `cd app && npx vitest run src/engine/constraints.test.ts`
Expected: PASS (10 testes no total).

- [ ] **Step 9: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/engine/constraints.ts app/src/engine/constraints.test.ts
git commit -m "feat(engine): validacao de restricoes (largura/profundidade/pe-direito minimos)"
```

---

## Task 4: Engine — fórmula de BTU

**Files:**
- Create: `app/src/engine/btu.ts`
- Test: `app/src/engine/btu.test.ts`

**Interfaces:**
- Consumes: `AC_SIZES_BTU` de `./constants`.
- Produces: `suggestBTU(areaM2: number, dryerCount: number): number` — usado pela Task 5 (`layout.ts`).

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, expect, it } from "vitest";
import { suggestBTU } from "./btu";

describe("suggestBTU", () => {
  it("20m² com 2 secadoras sugere 18000 BTU (base 16000)", () => {
    expect(suggestBTU(20, 2)).toBe(18000);
  });

  it("10m² sem secadora sugere 9000 BTU (base 6000)", () => {
    expect(suggestBTU(10, 0)).toBe(9000);
  });

  it("área muito grande satura no maior tamanho comercial (60000)", () => {
    expect(suggestBTU(200, 10)).toBe(60000);
  });

  it("base exatamente igual a um tamanho comercial retorna esse tamanho", () => {
    expect(suggestBTU(15, 0)).toBe(9000); // 15*600=9000
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/engine/btu.test.ts`
Expected: FAIL — módulo `./btu` não existe.

- [ ] **Step 3: Implementar `app/src/engine/btu.ts`**

```ts
import { AC_SIZES_BTU } from "./constants";

export function suggestBTU(areaM2: number, dryerCount: number): number {
  const base = areaM2 * 600 + dryerCount * 2000;
  const found = AC_SIZES_BTU.find((size) => size >= base);
  return found ?? AC_SIZES_BTU[AC_SIZES_BTU.length - 1];
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/engine/btu.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/engine/btu.ts app/src/engine/btu.test.ts
git commit -m "feat(engine): formula de recomendacao de BTU do ar-condicionado"
```

---

## Task 5: Engine — cálculo completo do layout

**Files:**
- Create: `app/src/engine/layout.ts`
- Test: `app/src/engine/layout.test.ts`

**Interfaces:**
- Consumes: `validate`, `resolveSelection`, `flattenSelection`, `countDryers` de `./constraints`; `suggestBTU` de `./btu`; constantes de `./constants`; tipos de `./types`.
- Produces: `computeLayout(state: ProjectState, catalog: CatalogMachine[]): LayoutResult` — usado pela Task 8 (`useLayout`) e por toda a UI/viewers.

- [ ] **Step 1: Escrever o teste de `computeLayout`**

```ts
import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import type { CatalogMachine, ProjectState } from "./types";

const catalog: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
  },
];

const validState: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 4200,
  ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 3 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  acOverrideBTU: null,
};

describe("computeLayout", () => {
  it("retorna layout null e violações quando a sala é pequena demais", () => {
    const result = computeLayout({ ...validState, roomWidthMm: 1000 }, catalog);
    expect(result.layout).toBeNull();
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("posiciona uma máquina por instância, sem sobreposição, dentro da sala", () => {
    const result = computeLayout(validState, catalog);
    expect(result.violations).toEqual([]);
    expect(result.layout).not.toBeNull();
    const placed = result.layout!.machines;
    expect(placed).toHaveLength(3);
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i].x).toBeGreaterThanOrEqual(placed[i - 1].x + placed[i - 1].widthMm);
    }
    for (const m of placed) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x + m.widthMm).toBeLessThanOrEqual(validState.roomWidthMm);
    }
  });

  it("gera um vão de drywall por máquina posicionada", () => {
    const result = computeLayout(validState, catalog);
    expect(result.layout!.drywall.openings).toHaveLength(3);
  });

  it("deixa o corredor técnico do lado escolhido (right = encostado na parede direita)", () => {
    const result = computeLayout(validState, catalog);
    const corridor = result.layout!.techCorridor;
    expect(corridor.x).toBe(validState.roomWidthMm - 500);
    expect(corridor.width).toBe(500);
  });

  it("deixa o corredor técnico do lado esquerdo quando techAccessSide=left", () => {
    const result = computeLayout({ ...validState, techAccessSide: "left" }, catalog);
    const corridor = result.layout!.techCorridor;
    expect(corridor.x).toBe(0);
  });

  it("inclui mobiliário quando furnitureEnabled=true", () => {
    const result = computeLayout(validState, catalog);
    expect(result.layout!.furniture).not.toBeNull();
    expect(result.layout!.furniture!.chairs).toHaveLength(3);
  });

  it("omite mobiliário quando furnitureEnabled=false", () => {
    const result = computeLayout({ ...validState, furnitureEnabled: false }, catalog);
    expect(result.layout!.furniture).toBeNull();
  });

  it("sugere BTU pela fórmula quando não há override", () => {
    const result = computeLayout(validState, catalog);
    const areaM2 = (validState.roomWidthMm / 1000) * (validState.roomDepthMm / 1000);
    expect(result.layout!.acSuggestedBTU).toBeGreaterThan(0);
    expect(result.layout!.acSuggestedBTU).toBeGreaterThanOrEqual(areaM2 * 600);
  });

  it("usa o override de BTU quando informado", () => {
    const result = computeLayout({ ...validState, acOverrideBTU: 36000 }, catalog);
    expect(result.layout!.acSuggestedBTU).toBe(36000);
  });

  it("inclui a porta frontal centralizada quando doorEnabled=true", () => {
    const result = computeLayout(validState, catalog);
    const door = result.layout!.frontDoor;
    expect(door).not.toBeNull();
    expect(door!.x + door!.width / 2).toBeCloseTo(validState.roomWidthMm / 2, 0);
    expect(door!.y).toBe(validState.roomDepthMm);
  });

  it("omite a porta frontal quando doorEnabled=false", () => {
    const result = computeLayout({ ...validState, doorEnabled: false }, catalog);
    expect(result.layout!.frontDoor).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/engine/layout.test.ts`
Expected: FAIL — módulo `./layout` não existe.

- [ ] **Step 3: Implementar `app/src/engine/layout.ts`**

```ts
import {
  countDryers,
  flattenSelection,
  machineRowWidthMm,
  resolveSelection,
  validate,
} from "./constraints";
import { suggestBTU } from "./btu";
import {
  DOOR_WIDTH_MM,
  DRYWALL_THICKNESS_MM,
  LATERAL_CLEARANCE_MM,
  MACHINE_GAP_MM,
  TECH_AREA_DEFAULT_MM,
  TOTEM_SIZE_MM,
} from "./constants";
import type {
  CatalogMachine,
  DrywallOpening,
  FurnitureLayout,
  Layout,
  LayoutResult,
  PlacedMachine,
  ProjectState,
  Rect,
} from "./types";

export function computeLayout(state: ProjectState, catalog: CatalogMachine[]): LayoutResult {
  const violations = validate(state, catalog);
  if (violations.length > 0) {
    return { layout: null, violations };
  }

  const resolved = resolveSelection(state.machines, catalog);
  const list = flattenSelection(resolved);

  const rowWidth = machineRowWidthMm(list);
  const startX =
    state.techAccessSide === "left"
      ? state.roomWidthMm - LATERAL_CLEARANCE_MM - rowWidth
      : LATERAL_CLEARANCE_MM;

  let cursorX = startX;
  const placed: PlacedMachine[] = list.map((m, i) => {
    const p: PlacedMachine = {
      catalogId: m.id,
      instanceIndex: i,
      x: cursorX,
      widthMm: m.widthMm,
      depthMm: m.depthMm,
      heightMm: m.heightMm,
    };
    cursorX += m.widthMm + MACHINE_GAP_MM;
    return p;
  });

  const maxDepthMm = Math.max(...list.map((m) => m.depthMm));
  const maxHeightMm = Math.max(...list.map((m) => m.heightMm));
  const drywallY = TECH_AREA_DEFAULT_MM + maxDepthMm;

  const openings: DrywallOpening[] = placed.map((p) => ({
    x: p.x,
    y: drywallY,
    width: p.widthMm,
    height: p.heightMm,
  }));

  const corridorX = state.techAccessSide === "left" ? 0 : state.roomWidthMm - LATERAL_CLEARANCE_MM;
  const techCorridor: Rect = { x: corridorX, y: 0, width: LATERAL_CLEARANCE_MM, height: drywallY };

  const dryerCount = countDryers(resolved);
  const areaM2 = (state.roomWidthMm / 1000) * (state.roomDepthMm / 1000);
  const acSuggestedBTU = state.acOverrideBTU ?? suggestBTU(areaM2, dryerCount);

  const furniture = state.furnitureEnabled
    ? placeFurniture(state, drywallY, corridorX)
    : null;

  const frontDoor: Rect | null = state.doorEnabled
    ? { x: state.roomWidthMm / 2 - DOOR_WIDTH_MM / 2, y: state.roomDepthMm, width: DOOR_WIDTH_MM, height: 0 }
    : null;

  const layout: Layout = {
    machines: placed,
    drywall: { y: drywallY, openings, heightMm: maxHeightMm + 200 },
    techCorridor,
    frontDoor,
    furniture,
    acSuggestedBTU,
    roomWidthMm: state.roomWidthMm,
    roomDepthMm: state.roomDepthMm,
    ceilingHeightMm: state.ceilingHeightMm,
  };

  return { layout, violations: [] };
}

function placeFurniture(state: ProjectState, drywallY: number, corridorX: number): FurnitureLayout {
  const salonFrontY = drywallY + DRYWALL_THICKNESS_MM;

  const totem: Rect = {
    x: corridorX + (LATERAL_CLEARANCE_MM - TOTEM_SIZE_MM.width) / 2,
    y: salonFrontY,
    width: TOTEM_SIZE_MM.width,
    height: TOTEM_SIZE_MM.depth,
  };

  const salonDepth = state.roomDepthMm - salonFrontY;
  const tableWidth = 900;
  const tableDepth = 700;
  const table: Rect = {
    x: state.roomWidthMm / 2 - tableWidth / 2,
    y: salonFrontY + salonDepth / 2 - tableDepth / 2,
    width: tableWidth,
    height: tableDepth,
  };

  const chairSize = 400;
  const chairs: Rect[] = [
    {
      x: table.x - chairSize - 50,
      y: table.y + tableDepth / 2 - chairSize / 2,
      width: chairSize,
      height: chairSize,
    },
    {
      x: table.x + tableWidth + 50,
      y: table.y + tableDepth / 2 - chairSize / 2,
      width: chairSize,
      height: chairSize,
    },
    {
      x: table.x + tableWidth / 2 - chairSize / 2,
      y: table.y + tableDepth + 50,
      width: chairSize,
      height: chairSize,
    },
  ];

  const acWidth = 900;
  const ac: Rect = { x: state.roomWidthMm / 2 - acWidth / 2, y: 0, width: acWidth, height: 200 };

  return { table, chairs, totem, ac };
}
```

- [ ] **Step 4: Rodar e confirmar que todos os testes passam**

Run: `cd app && npx vitest run src/engine/layout.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Rodar a suíte inteira do engine até aqui**

Run: `cd app && npx vitest run src/engine`
Expected: PASS (todos os testes de constants, constraints, btu e layout).

- [ ] **Step 6: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/engine/layout.ts app/src/engine/layout.test.ts
git commit -m "feat(engine): calculo completo do layout (maquinas, drywall, corredor, mobiliario, BTU)"
```

---

## Task 6: Catálogo editável (seed + CRUD + localStorage)

**Files:**
- Create: `app/src/catalog/seed.ts`
- Create: `app/src/catalog/store.ts`
- Test: `app/src/catalog/store.test.ts`

**Interfaces:**
- Consumes: `CatalogMachine` de `../engine/types`.
- Produces: `CATALOG_SEED: CatalogMachine[]`; `getCatalog(): CatalogMachine[]`, `addMachine`, `updateMachine`, `deleteMachine`, `restoreDefaults`, `exportCatalogJSON(): string`, `importCatalogJSON(json: string): CatalogMachine[]`, `subscribeCatalog(listener: () => void): () => void` — usados pela Task 7 (`useLayout`), Task 12 (`ControlPanel`), Task 13 (`CatalogManager`).

- [ ] **Step 1: Escrever `app/src/catalog/seed.ts`**

```ts
import type { CatalogMachine } from "../engine/types";

export const CATALOG_SEED: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack Elétrica (SSU/SSG)",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
    breakerLavadoraA: 16,
    breakerSecadoraA: 32,
    cableMm2: "6mm² (≤4,5m) / 10mm² (>4,5m)",
    drainLpm: 14,
  },
  {
    id: "mamute-smart10",
    brand: "Mamute",
    model: "Smart 10",
    type: "stack",
    widthMm: 680,
    depthMm: 880,
    heightMm: 2040,
    breakerLavadoraA: 16,
    breakerSecadoraA: 40,
    cableMm2: "2x2,5mm² (lavadora) / 2x10mm² (secadora)",
    exhaustDiameterMm: 100,
    drainInch: '2"',
    weightKg: 250,
  },
  {
    id: "mamute-smart17",
    brand: "Mamute",
    model: "Smart 17",
    type: "stack",
    widthMm: 835,
    depthMm: 1190,
    heightMm: 2210,
    exhaustDiameterMm: 150,
    drainInch: '3"',
    weightKg: 615,
  },
];
```

- [ ] **Step 2: Escrever o teste de `app/src/catalog/store.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  addMachine,
  deleteMachine,
  exportCatalogJSON,
  getCatalog,
  importCatalogJSON,
  restoreDefaults,
  updateMachine,
} from "./store";
import { CATALOG_SEED } from "./seed";

beforeEach(() => {
  localStorage.clear();
});

describe("catalog store", () => {
  it("retorna o catálogo seed quando não há nada salvo", () => {
    expect(getCatalog()).toEqual(CATALOG_SEED);
  });

  it("adiciona uma máquina nova e persiste", () => {
    const custom = { ...CATALOG_SEED[0], id: "custom-1", model: "Custom" };
    addMachine(custom);
    expect(getCatalog()).toContainEqual(custom);
  });

  it("atualiza uma máquina existente mantendo o id", () => {
    updateMachine("sq-stack", { model: "Stack Atualizada" });
    const updated = getCatalog().find((m) => m.id === "sq-stack");
    expect(updated?.model).toBe("Stack Atualizada");
  });

  it("remove uma máquina", () => {
    deleteMachine("sq-stack");
    expect(getCatalog().find((m) => m.id === "sq-stack")).toBeUndefined();
  });

  it("restaura o catálogo padrão", () => {
    deleteMachine("sq-stack");
    restoreDefaults();
    expect(getCatalog()).toEqual(CATALOG_SEED);
  });

  it("exporta e reimporta o catálogo mantendo os dados", () => {
    const json = exportCatalogJSON();
    deleteMachine("sq-stack");
    const imported = importCatalogJSON(json);
    expect(imported).toEqual(CATALOG_SEED);
    expect(getCatalog()).toEqual(CATALOG_SEED);
  });

  it("rejeita JSON que não é um array", () => {
    expect(() => importCatalogJSON('{"a":1}')).toThrow();
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/catalog/store.test.ts`
Expected: FAIL — módulo `./store` não existe.

- [ ] **Step 4: Implementar `app/src/catalog/store.ts`**

```ts
import type { CatalogMachine } from "../engine/types";
import { CATALOG_SEED } from "./seed";

const STORAGE_KEY = "lavanderia.catalog.v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeCatalog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCatalog(): CatalogMachine[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return CATALOG_SEED;
  try {
    const parsed = JSON.parse(raw) as CatalogMachine[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : CATALOG_SEED;
  } catch {
    return CATALOG_SEED;
  }
}

function persist(list: CatalogMachine[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  emitChange();
}

export function addMachine(machine: CatalogMachine): CatalogMachine[] {
  const list = [...getCatalog(), machine];
  persist(list);
  return list;
}

export function updateMachine(id: string, patch: Partial<CatalogMachine>): CatalogMachine[] {
  const list = getCatalog().map((m) => (m.id === id ? { ...m, ...patch, id } : m));
  persist(list);
  return list;
}

export function deleteMachine(id: string): CatalogMachine[] {
  const list = getCatalog().filter((m) => m.id !== id);
  persist(list);
  return list;
}

export function restoreDefaults(): CatalogMachine[] {
  persist(CATALOG_SEED);
  return CATALOG_SEED;
}

export function exportCatalogJSON(): string {
  return JSON.stringify(getCatalog(), null, 2);
}

export function importCatalogJSON(json: string): CatalogMachine[] {
  const parsed = JSON.parse(json) as CatalogMachine[];
  if (!Array.isArray(parsed)) {
    throw new Error("JSON inválido: esperado um array de máquinas.");
  }
  persist(parsed);
  return parsed;
}
```

- [ ] **Step 5: Rodar e confirmar que todos os testes passam**

Run: `cd app && npx vitest run src/catalog/store.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 6: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/catalog/
git commit -m "feat(catalog): catalogo seed editavel com CRUD, localStorage e import/export JSON"
```

---

## Task 7: Estado global do projeto (Zustand)

**Files:**
- Create: `app/src/state/projectStore.ts`
- Test: `app/src/state/projectStore.test.ts`

**Interfaces:**
- Consumes: `ProjectState`, `MachineSelection`, `TechAccessSide` de `../engine/types`.
- Produces: hook `useProjectStore` (Zustand) com estado `ProjectState` + ações `setRoomWidthMm`, `setRoomDepthMm`, `setCeilingHeightMm`, `setMachineQty`, `removeMachine`, `toggleDoor`, `setTechAccessSide`, `toggleFurniture`, `setAcOverrideBTU` — usado pela Task 8 (`useLayout`) e pela UI (Tasks 12-14).

- [ ] **Step 1: Escrever o teste**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "./projectStore";

function getState() {
  return useProjectStore.getState();
}

describe("useProjectStore", () => {
  beforeEach(() => {
    useProjectStore.setState({
      roomWidthMm: 4000,
      roomDepthMm: 3000,
      ceilingHeightMm: 2700,
      machines: [{ catalogId: "sq-stack", qty: 3 }],
      doorEnabled: true,
      techAccessSide: "right",
      furnitureEnabled: true,
      acOverrideBTU: null,
    });
  });

  it("atualiza largura, profundidade e pé-direito", () => {
    getState().setRoomWidthMm(6000);
    getState().setRoomDepthMm(5000);
    getState().setCeilingHeightMm(2900);
    expect(getState().roomWidthMm).toBe(6000);
    expect(getState().roomDepthMm).toBe(5000);
    expect(getState().ceilingHeightMm).toBe(2900);
  });

  it("adiciona uma nova seleção de máquina quando o catalogId não existe ainda", () => {
    getState().setMachineQty("mamute-smart10", 2);
    expect(getState().machines).toContainEqual({ catalogId: "mamute-smart10", qty: 2 });
  });

  it("atualiza a quantidade de uma máquina já selecionada", () => {
    getState().setMachineQty("sq-stack", 5);
    expect(getState().machines).toContainEqual({ catalogId: "sq-stack", qty: 5 });
  });

  it("remove a seleção quando a quantidade vira zero", () => {
    getState().setMachineQty("sq-stack", 0);
    expect(getState().machines.find((m) => m.catalogId === "sq-stack")).toBeUndefined();
  });

  it("remove uma máquina explicitamente", () => {
    getState().removeMachine("sq-stack");
    expect(getState().machines).toEqual([]);
  });

  it("alterna porta e mobiliário", () => {
    getState().toggleDoor();
    expect(getState().doorEnabled).toBe(false);
    getState().toggleFurniture();
    expect(getState().furnitureEnabled).toBe(false);
  });

  it("define o lado de acesso técnico", () => {
    getState().setTechAccessSide("left");
    expect(getState().techAccessSide).toBe("left");
  });

  it("define o override de BTU", () => {
    getState().setAcOverrideBTU(36000);
    expect(getState().acOverrideBTU).toBe(36000);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/state/projectStore.test.ts`
Expected: FAIL — módulo `./projectStore` não existe.

- [ ] **Step 3: Implementar `app/src/state/projectStore.ts`**

```ts
import { create } from "zustand";
import type { MachineSelection, ProjectState, TechAccessSide } from "../engine/types";

interface ProjectStore extends ProjectState {
  setRoomWidthMm: (mm: number) => void;
  setRoomDepthMm: (mm: number) => void;
  setCeilingHeightMm: (mm: number) => void;
  setMachineQty: (catalogId: string, qty: number) => void;
  removeMachine: (catalogId: string) => void;
  toggleDoor: () => void;
  setTechAccessSide: (side: TechAccessSide) => void;
  toggleFurniture: () => void;
  setAcOverrideBTU: (btu: number | null) => void;
}

const initialState: ProjectState = {
  roomWidthMm: 4000,
  roomDepthMm: 4000,
  ceilingHeightMm: 2700,
  machines: [{ catalogId: "sq-stack", qty: 3 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  acOverrideBTU: null,
};

export const useProjectStore = create<ProjectStore>()((set) => ({
  ...initialState,
  setRoomWidthMm: (mm) => set({ roomWidthMm: mm }),
  setRoomDepthMm: (mm) => set({ roomDepthMm: mm }),
  setCeilingHeightMm: (mm) => set({ ceilingHeightMm: mm }),
  setMachineQty: (catalogId, qty) =>
    set((state) => {
      const exists = state.machines.some((m) => m.catalogId === catalogId);
      const machines: MachineSelection[] = exists
        ? state.machines.map((m) => (m.catalogId === catalogId ? { ...m, qty } : m))
        : [...state.machines, { catalogId, qty }];
      return { machines: machines.filter((m) => m.qty > 0) };
    }),
  removeMachine: (catalogId) =>
    set((state) => ({ machines: state.machines.filter((m) => m.catalogId !== catalogId) })),
  toggleDoor: () => set((state) => ({ doorEnabled: !state.doorEnabled })),
  setTechAccessSide: (side) => set({ techAccessSide: side }),
  toggleFurniture: () => set((state) => ({ furnitureEnabled: !state.furnitureEnabled })),
  setAcOverrideBTU: (btu) => set({ acOverrideBTU: btu }),
}));
```

- [ ] **Step 4: Rodar e confirmar que todos os testes passam**

Run: `cd app && npx vitest run src/state/projectStore.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/state/projectStore.ts app/src/state/projectStore.test.ts
git commit -m "feat(state): store Zustand do projeto (dimensoes, maquinas, porta, acesso, mobiliario)"
```

---

## Task 8: Hook `useLayout` (combina estado + catálogo + engine)

**Files:**
- Create: `app/src/state/useLayout.ts`
- Test: `app/src/state/useLayout.test.tsx`

**Interfaces:**
- Consumes: `useProjectStore` de `./projectStore`; `getCatalog`, `subscribeCatalog` de `../catalog/store`; `computeLayout` de `../engine/layout`.
- Produces: hook `useLayout(): LayoutResult` — usado pela Task 14 (`App.tsx`) e indiretamente por todos os componentes de UI que precisam do layout atual.

- [ ] **Step 1: Escrever o teste (com `@testing-library/react` `renderHook`)**

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayout } from "./useLayout";
import { useProjectStore } from "./projectStore";

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({
    roomWidthMm: 5000,
    roomDepthMm: 4200,
    ceilingHeightMm: 2400,
    machines: [{ catalogId: "sq-stack", qty: 2 }],
    doorEnabled: true,
    techAccessSide: "right",
    furnitureEnabled: true,
    acOverrideBTU: null,
  });
});

describe("useLayout", () => {
  it("retorna um layout válido para um estado consistente", () => {
    const { result } = renderHook(() => useLayout());
    expect(result.current.violations).toEqual([]);
    expect(result.current.layout?.machines).toHaveLength(2);
  });

  it("recalcula quando o estado do projeto muda", () => {
    const { result } = renderHook(() => useLayout());
    act(() => {
      useProjectStore.getState().setMachineQty("sq-stack", 5);
    });
    expect(result.current.layout?.machines).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/state/useLayout.test.tsx`
Expected: FAIL — módulo `./useLayout` não existe.

- [ ] **Step 3: Implementar `app/src/state/useLayout.ts`**

```ts
import { useMemo, useSyncExternalStore } from "react";
import { useProjectStore } from "./projectStore";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import { computeLayout } from "../engine/layout";
import type { LayoutResult } from "../engine/types";

export function useLayout(): LayoutResult {
  const state = useProjectStore();
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);

  return useMemo(() => computeLayout(state, catalog), [state, catalog]);
}
```

- [ ] **Step 4: Rodar e confirmar que todos os testes passam**

Run: `cd app && npx vitest run src/state/useLayout.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/state/useLayout.ts app/src/state/useLayout.test.tsx
git commit -m "feat(state): hook useLayout combinando projectStore + catalogo + engine"
```

---

## Task 9: Planta 2D (SVG)

**Files:**
- Create: `app/src/viewer2d/FloorPlan.tsx`
- Test: `app/src/viewer2d/FloorPlan.test.tsx`

**Interfaces:**
- Consumes: `Layout` de `../engine/types`.
- Produces: componente `FloorPlan` (com `forwardRef<SVGSVGElement, { layout: Layout }>`) — usado pela Task 14 (`App.tsx`) e pela Task 11 (export PNG/PDF via ref do SVG).

- [ ] **Step 1: Escrever o teste**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloorPlan } from "./FloorPlan";
import { computeLayout } from "../engine/layout";
import type { CatalogMachine, ProjectState } from "../engine/types";

const catalog: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
  },
];

const state: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 4200,
  ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 2 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  acOverrideBTU: null,
};

describe("FloorPlan", () => {
  it("renderiza um svg com uma caixa por máquina posicionada", () => {
    const { layout } = computeLayout(state, catalog);
    render(<FloorPlan layout={layout!} />);
    const svg = screen.getByRole("img", { name: /planta baixa/i });
    expect(svg.querySelectorAll("rect").length).toBeGreaterThanOrEqual(layout!.machines.length);
  });

  it("mostra a área em metros no rodapé da planta", () => {
    const { layout } = computeLayout(state, catalog);
    render(<FloorPlan layout={layout!} />);
    expect(screen.getByText(/5\.00m x 4\.20m/)).toBeInTheDocument();
  });

  it("desenha o arco de abertura da porta frontal quando doorEnabled=true", () => {
    const { layout } = computeLayout(state, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelector("path")).not.toBeNull();
  });

  it("não desenha arco de porta quando doorEnabled=false", () => {
    const { layout } = computeLayout({ ...state, doorEnabled: false }, catalog);
    const { container } = render(<FloorPlan layout={layout!} />);
    expect(container.querySelector("path")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/viewer2d/FloorPlan.test.tsx`
Expected: FAIL — módulo `./FloorPlan` não existe.

- [ ] **Step 3: Implementar `app/src/viewer2d/FloorPlan.tsx`**

```tsx
import { forwardRef } from "react";
import type { Layout } from "../engine/types";

const SCALE = 0.08; // px por mm

function mm(value: number): number {
  return value * SCALE;
}

export const FloorPlan = forwardRef<SVGSVGElement, { layout: Layout }>(function FloorPlan(
  { layout },
  ref
) {
  const width = mm(layout.roomWidthMm);
  const height = mm(layout.roomDepthMm);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Planta baixa da lavanderia"
    >
      <rect x={0} y={0} width={width} height={height} fill="#f7f7f5" stroke="#333" strokeWidth={2} />

      {layout.machines.map((machine) => (
        <rect
          key={`${machine.catalogId}-${machine.instanceIndex}`}
          x={mm(machine.x)}
          y={0}
          width={mm(machine.widthMm)}
          height={mm(machine.depthMm)}
          fill="#9fb8d9"
          stroke="#1f3a5f"
        />
      ))}

      <line
        x1={0}
        y1={mm(layout.drywall.y)}
        x2={width}
        y2={mm(layout.drywall.y)}
        stroke="#8a5a2b"
        strokeWidth={4}
      />
      {layout.drywall.openings.map((o, i) => (
        <rect
          key={i}
          x={mm(o.x)}
          y={mm(layout.drywall.y) - 2}
          width={mm(o.width)}
          height={4}
          fill="#f7f7f5"
        />
      ))}

      <rect
        x={mm(layout.techCorridor.x)}
        y={mm(layout.techCorridor.y)}
        width={mm(layout.techCorridor.width)}
        height={mm(layout.techCorridor.height)}
        fill="none"
        stroke="#999"
        strokeDasharray="6 4"
      />

      {layout.frontDoor && (
        <>
          <line
            x1={mm(layout.frontDoor.x)}
            y1={height}
            x2={mm(layout.frontDoor.x + layout.frontDoor.width)}
            y2={height}
            stroke="#f7f7f5"
            strokeWidth={4}
          />
          <path
            d={`M ${mm(layout.frontDoor.x)} ${height} A ${mm(layout.frontDoor.width)} ${mm(
              layout.frontDoor.width
            )} 0 0 1 ${mm(layout.frontDoor.x + layout.frontDoor.width)} ${
              height - mm(layout.frontDoor.width)
            }`}
            fill="none"
            stroke="#1f3a5f"
            strokeDasharray="4 3"
          />
        </>
      )}

      {layout.furniture && (
        <>
          <rect
            x={mm(layout.furniture.totem.x)}
            y={mm(layout.furniture.totem.y)}
            width={mm(layout.furniture.totem.width)}
            height={mm(layout.furniture.totem.height)}
            fill="#333333"
          />
          <rect
            x={mm(layout.furniture.table.x)}
            y={mm(layout.furniture.table.y)}
            width={mm(layout.furniture.table.width)}
            height={mm(layout.furniture.table.height)}
            fill="#c9a97a"
          />
          {layout.furniture.chairs.map((c, i) => (
            <rect
              key={i}
              x={mm(c.x)}
              y={mm(c.y)}
              width={mm(c.width)}
              height={mm(c.height)}
              fill="#d9c7a3"
            />
          ))}
          <rect
            x={mm(layout.furniture.ac.x)}
            y={mm(layout.furniture.ac.y)}
            width={mm(layout.furniture.ac.width)}
            height={mm(layout.furniture.ac.height)}
            fill="#7fb3d5"
          />
        </>
      )}

      <text x={8} y={height - 8} fontSize={12} fill="#333">
        {(layout.roomWidthMm / 1000).toFixed(2)}m x {(layout.roomDepthMm / 1000).toFixed(2)}m
      </text>
    </svg>
  );
});
```

- [ ] **Step 4: Rodar e confirmar que todos os testes passam**

Run: `cd app && npx vitest run src/viewer2d/FloorPlan.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/viewer2d/
git commit -m "feat(viewer2d): planta baixa SVG com cotas, drywall, corredor tecnico e mobiliario"
```

---

## Task 10: Planta 3D (React-Three-Fiber) com animação de transição

**Files:**
- Create: `app/src/viewer3d/useLerpedVector3.ts`
- Create: `app/src/viewer3d/Scene.tsx`

**Interfaces:**
- Consumes: `Layout` de `../engine/types`; `TOTEM_SIZE_MM` de `../engine/constants`.
- Produces: `useLerpedVector3(target: [number, number, number], durationMs?: number): Vector3`; componente `Scene({ layout, onCanvasReady? })` — usado pela Task 14 (`App.tsx`).

**Nota de escopo:** componentes que montam um `<Canvas>` do react-three-fiber dependem de WebGL, indisponível no ambiente jsdom do Vitest. Esta task não tem teste automatizado — a verificação é manual, feita na Task 15 (checklist de QA), rodando `npm run dev` e conferindo visualmente a cena e a animação de transição. Isso está alinhado com a seção 8 do spec ("sem verificação pixel-a-pixel do 3D").

- [ ] **Step 1: Implementar `app/src/viewer3d/useLerpedVector3.ts`**

```ts
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

export function useLerpedVector3(target: [number, number, number], durationMs = 400): Vector3 {
  const current = useRef(new Vector3(...target));
  const from = useRef(new Vector3(...target));
  const to = useRef(new Vector3(...target));
  const elapsed = useRef(durationMs);

  if (to.current.x !== target[0] || to.current.y !== target[1] || to.current.z !== target[2]) {
    from.current.copy(current.current);
    to.current.set(target[0], target[1], target[2]);
    elapsed.current = 0;
  }

  useFrame((_, delta) => {
    if (elapsed.current < durationMs) {
      elapsed.current = Math.min(durationMs, elapsed.current + delta * 1000);
      const t = elapsed.current / durationMs;
      current.current.lerpVectors(from.current, to.current, t);
    }
  });

  return current.current;
}
```

- [ ] **Step 2: Implementar `app/src/viewer3d/Scene.tsx`**

```tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useLerpedVector3 } from "./useLerpedVector3";
import { TOTEM_SIZE_MM } from "../engine/constants";
import type { Layout, PlacedMachine } from "../engine/types";

const M = (mmValue: number) => mmValue / 1000;

function MachineMesh({ catalogId, instanceIndex, x, widthMm, depthMm, heightMm }: PlacedMachine) {
  const w = M(widthMm);
  const d = M(depthMm);
  const h = M(heightMm);
  const position = useLerpedVector3([M(x) + w / 2, h / 2, d / 2]);

  return (
    <mesh position={position} castShadow key={`${catalogId}-${instanceIndex}`}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color="#9fb8d9" />
    </mesh>
  );
}

export function Scene({
  layout,
  onCanvasReady,
}: {
  layout: Layout;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}) {
  const roomW = M(layout.roomWidthMm);
  const roomD = M(layout.roomDepthMm);
  const roomH = M(layout.ceilingHeightMm);

  return (
    <Canvas
      gl={{ preserveDrawingBuffer: true }}
      camera={{ position: [roomW, roomH * 1.5, roomD * 1.5], fov: 50 }}
      onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[roomW, roomH * 2, roomD]} intensity={0.8} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomW / 2, 0, roomD / 2]} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>

      {layout.machines.map((machine) => (
        <MachineMesh key={`${machine.catalogId}-${machine.instanceIndex}`} {...machine} />
      ))}

      {layout.furniture && (
        <mesh
          position={[
            M(layout.furniture.totem.x) + M(layout.furniture.totem.width) / 2,
            M(TOTEM_SIZE_MM.height) / 2,
            M(layout.furniture.totem.y) + M(layout.furniture.totem.height) / 2,
          ]}
        >
          <boxGeometry
            args={[M(layout.furniture.totem.width), M(TOTEM_SIZE_MM.height), M(layout.furniture.totem.height)]}
          />
          <meshStandardMaterial color="#333333" />
        </mesh>
      )}

      <OrbitControls enableDamping dampingFactor={0.1} />
    </Canvas>
  );
}
```

- [ ] **Step 3: Verificar que o projeto compila (TypeScript)**

Run: `cd app && npx tsc --noEmit`
Expected: sem erros de tipo nos novos arquivos.

- [ ] **Step 4: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/viewer3d/
git commit -m "feat(viewer3d): cena R3F com maquinas, mobiliario e animacao de transicao (lerp 400ms)"
```

---

## Task 11: Exportação (PNG/PDF 2D, PNG 3D)

**Files:**
- Create: `app/src/export/download.ts`
- Create: `app/src/export/export2d.ts`
- Create: `app/src/export/export3d.ts`
- Test: `app/src/export/download.test.ts`
- Test: `app/src/export/export3d.test.ts`

**Interfaces:**
- Consumes: nada de engine (trabalha com elementos DOM: `SVGSVGElement`, `HTMLCanvasElement`).
- Produces: `downloadDataUrl(dataUrl: string, filename: string): void`; `exportFloorPlanPNG(svg, filename?): Promise<void>`, `exportFloorPlanPDF(svg, meta, filename?): Promise<void>`; `exportSceneScreenshot(canvas, filename?): void` — usados pela Task 14 (`App.tsx`).

**Nota de escopo:** `svgToPngDataUrl` (dentro de `export2d.ts`) depende de rasterização real de `<img>`/`<canvas>` no navegador — jsdom não implementa decodificação de imagem, então essa função específica não tem teste automatizado; é coberta no checklist manual da Task 15. `downloadDataUrl` e `exportSceneScreenshot` são testáveis porque dependem só de APIs simples de DOM/canvas que podem ser mockadas.

- [ ] **Step 1: Escrever o teste de `download.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { downloadDataUrl } from "./download";

describe("downloadDataUrl", () => {
  it("cria um link temporário, clica nele e remove do DOM", () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });

    downloadDataUrl("data:text/plain,hello", "arquivo.txt");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/export/download.test.ts`
Expected: FAIL — módulo `./download` não existe.

- [ ] **Step 3: Implementar `app/src/export/download.ts`**

```ts
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/export/download.test.ts`
Expected: PASS (1 teste).

- [ ] **Step 5: Escrever o teste de `export3d.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { exportSceneScreenshot } from "./export3d";
import * as downloadModule from "./download";

describe("exportSceneScreenshot", () => {
  it("captura o canvas como PNG e aciona o download", () => {
    const canvas = document.createElement("canvas");
    canvas.toDataURL = vi.fn().mockReturnValue("data:image/png;base64,FAKE");
    const downloadSpy = vi.spyOn(downloadModule, "downloadDataUrl").mockImplementation(() => {});

    exportSceneScreenshot(canvas, "teste.png");

    expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
    expect(downloadSpy).toHaveBeenCalledWith("data:image/png;base64,FAKE", "teste.png");
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 6: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/export/export3d.test.ts`
Expected: FAIL — módulo `./export3d` não existe.

- [ ] **Step 7: Implementar `app/src/export/export3d.ts`**

```ts
import { downloadDataUrl } from "./download";

export function exportSceneScreenshot(canvas: HTMLCanvasElement, filename = "planta-3d.png"): void {
  const dataUrl = canvas.toDataURL("image/png");
  downloadDataUrl(dataUrl, filename);
}
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/export/export3d.test.ts`
Expected: PASS (1 teste).

- [ ] **Step 9: Implementar `app/src/export/export2d.ts`** (sem teste automatizado — ver nota de escopo acima)

```ts
import { downloadDataUrl } from "./download";

export async function exportFloorPlanPNG(svg: SVGSVGElement, filename = "planta-2d.png"): Promise<void> {
  const dataUrl = await svgToPngDataUrl(svg);
  downloadDataUrl(dataUrl, filename);
}

export async function exportFloorPlanPDF(
  svg: SVGSVGElement,
  meta: { projectName: string; areaM2: number },
  filename = "planta-2d.pdf"
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pngDataUrl = await svgToPngDataUrl(svg);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(14);
  doc.text(meta.projectName, 10, 12);
  doc.setFontSize(10);
  doc.text(
    `Área: ${meta.areaM2.toFixed(2)} m² — Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    10,
    18
  );

  const imgMargin = 10;
  const imgWidth = pageWidth - imgMargin * 2;
  const imgHeight = pageHeight - 30;
  doc.addImage(pngDataUrl, "PNG", imgMargin, 24, imgWidth, imgHeight, undefined, "FAST");

  doc.save(filename);
}

function svgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const viewBox = svg.viewBox.baseVal;
      canvas.width = viewBox.width || svg.clientWidth;
      canvas.height = viewBox.height || svg.clientHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context indisponível."));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao converter SVG em imagem."));
    };
    img.src = url;
  });
}
```

- [ ] **Step 10: Verificar que o projeto compila**

Run: `cd app && npx tsc --noEmit`
Expected: sem erros de tipo.

- [ ] **Step 11: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/export/
git commit -m "feat(export): download PNG/PDF da planta 2D e PNG da planta 3D"
```

---

## Task 12: Painel de controle e painel de violações

**Files:**
- Create: `app/src/ui/ControlPanel.tsx`
- Create: `app/src/ui/ViolationsPanel.tsx`
- Test: `app/src/ui/ControlPanel.test.tsx`
- Test: `app/src/ui/ViolationsPanel.test.tsx`

**Interfaces:**
- Consumes: `useProjectStore` de `../state/projectStore`; `getCatalog`, `subscribeCatalog` de `../catalog/store`; `Violation` de `../engine/types`.
- Produces: componentes `ControlPanel` e `ViolationsPanel({ violations })` — usados pela Task 14 (`App.tsx`).

- [ ] **Step 1: Escrever o teste de `ControlPanel`**

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlPanel } from "./ControlPanel";
import { useProjectStore } from "../state/projectStore";

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({
    roomWidthMm: 4000,
    roomDepthMm: 3500,
    ceilingHeightMm: 2700,
    machines: [{ catalogId: "sq-stack", qty: 3 }],
    doorEnabled: true,
    techAccessSide: "right",
    furnitureEnabled: true,
    acOverrideBTU: null,
  });
});

describe("ControlPanel", () => {
  it("mostra a largura atual em metros", () => {
    render(<ControlPanel />);
    expect(screen.getByLabelText(/largura/i)).toHaveValue(4);
  });

  it("atualiza a largura no store ao digitar", async () => {
    render(<ControlPanel />);
    const input = screen.getByLabelText(/largura/i);
    await userEvent.clear(input);
    await userEvent.type(input, "6");
    expect(useProjectStore.getState().roomWidthMm).toBe(6000);
  });

  it("alterna o lado de acesso técnico", async () => {
    render(<ControlPanel />);
    const select = screen.getByLabelText(/lado de acesso técnico/i);
    await userEvent.selectOptions(select, "left");
    expect(useProjectStore.getState().techAccessSide).toBe("left");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/ui/ControlPanel.test.tsx`
Expected: FAIL — módulo `./ControlPanel` não existe.

- [ ] **Step 3: Implementar `app/src/ui/ControlPanel.tsx`**

```tsx
import { useSyncExternalStore } from "react";
import { useProjectStore } from "../state/projectStore";
import { getCatalog, subscribeCatalog } from "../catalog/store";
import type { TechAccessSide } from "../engine/types";

export function ControlPanel() {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const state = useProjectStore();

  return (
    <section aria-label="Parâmetros da lavanderia">
      <label>
        Largura (m)
        <input
          type="number"
          step={0.1}
          min={0.1}
          value={state.roomWidthMm / 1000}
          onChange={(e) => state.setRoomWidthMm(Number(e.target.value) * 1000)}
        />
      </label>

      <label>
        Profundidade (m)
        <input
          type="number"
          step={0.1}
          min={0.1}
          value={state.roomDepthMm / 1000}
          onChange={(e) => state.setRoomDepthMm(Number(e.target.value) * 1000)}
        />
      </label>

      <label>
        Pé-direito (m)
        <input
          type="number"
          step={0.1}
          min={0.1}
          value={state.ceilingHeightMm / 1000}
          onChange={(e) => state.setCeilingHeightMm(Number(e.target.value) * 1000)}
        />
      </label>

      <fieldset>
        <legend>Máquinas</legend>
        {catalog.map((machine) => {
          const selection = state.machines.find((m) => m.catalogId === machine.id);
          return (
            <label key={machine.id}>
              {machine.brand} {machine.model}
              <input
                type="number"
                min={0}
                value={selection?.qty ?? 0}
                onChange={(e) => state.setMachineQty(machine.id, Number(e.target.value))}
              />
            </label>
          );
        })}
      </fieldset>

      <label>
        <input type="checkbox" checked={state.doorEnabled} onChange={state.toggleDoor} />
        Porta frontal
      </label>

      <label>
        Lado de acesso técnico
        <select
          value={state.techAccessSide}
          onChange={(e) => state.setTechAccessSide(e.target.value as TechAccessSide)}
        >
          <option value="left">Esquerda</option>
          <option value="right">Direita</option>
        </select>
      </label>

      <label>
        <input type="checkbox" checked={state.furnitureEnabled} onChange={state.toggleFurniture} />
        Mobiliário (mesa, cadeiras, totem, ar-condicionado)
      </label>
    </section>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run src/ui/ControlPanel.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Escrever o teste de `ViolationsPanel`**

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViolationsPanel } from "./ViolationsPanel";
import { useProjectStore } from "../state/projectStore";
import type { Violation } from "../engine/types";

beforeEach(() => {
  useProjectStore.setState({
    roomWidthMm: 1000,
    roomDepthMm: 3500,
    ceilingHeightMm: 2700,
    machines: [{ catalogId: "sq-stack", qty: 3 }],
    doorEnabled: true,
    techAccessSide: "right",
    furnitureEnabled: true,
    acOverrideBTU: null,
  });
});

describe("ViolationsPanel", () => {
  it("não renderiza nada quando não há violações", () => {
    const { container } = render(<ViolationsPanel violations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a mensagem e aplica a sugestão ao clicar no botão", async () => {
    const violation: Violation = {
      code: "WIDTH_TOO_SMALL",
      message: "Largura insuficiente. Mínimo: 3.07m.",
      field: "roomWidthMm",
      suggestedValueMm: 3070,
    };
    render(<ViolationsPanel violations={[violation]} />);
    expect(screen.getByText(/largura insuficiente/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /aplicar sugestão/i }));
    expect(useProjectStore.getState().roomWidthMm).toBe(3070);
  });
});
```

- [ ] **Step 6: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/ui/ViolationsPanel.test.tsx`
Expected: FAIL — módulo `./ViolationsPanel` não existe.

- [ ] **Step 7: Implementar `app/src/ui/ViolationsPanel.tsx`**

```tsx
import { useProjectStore } from "../state/projectStore";
import type { Violation } from "../engine/types";

export function ViolationsPanel({ violations }: { violations: Violation[] }) {
  const state = useProjectStore();
  if (violations.length === 0) return null;

  function applySuggestion(v: Violation): void {
    if (v.field === "roomWidthMm") state.setRoomWidthMm(v.suggestedValueMm);
    else if (v.field === "roomDepthMm") state.setRoomDepthMm(v.suggestedValueMm);
    else if (v.field === "ceilingHeightMm") state.setCeilingHeightMm(v.suggestedValueMm);
  }

  return (
    <ul role="alert" aria-label="Avisos de dimensionamento">
      {violations.map((v) => (
        <li key={v.code}>
          {v.message}
          {v.field !== "machines" && (
            <button type="button" onClick={() => applySuggestion(v)}>
              Aplicar sugestão
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 8: Rodar e confirmar que todos os testes passam**

Run: `cd app && npx vitest run src/ui/ControlPanel.test.tsx src/ui/ViolationsPanel.test.tsx`
Expected: PASS (5 testes no total).

- [ ] **Step 9: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/ui/ControlPanel.tsx app/src/ui/ViolationsPanel.tsx app/src/ui/ControlPanel.test.tsx app/src/ui/ViolationsPanel.test.tsx
git commit -m "feat(ui): painel de controle de parametros e painel de violacoes com aplicar sugestao"
```

---

## Task 13: Gerenciador de catálogo (CRUD na UI)

**Files:**
- Create: `app/src/ui/CatalogManager.tsx`
- Test: `app/src/ui/CatalogManager.test.tsx`

**Interfaces:**
- Consumes: `getCatalog`, `subscribeCatalog`, `addMachine`, `deleteMachine`, `restoreDefaults`, `exportCatalogJSON` de `../catalog/store`; `CatalogMachine` de `../engine/types`.
- Produces: componente `CatalogManager({ onClose })` — usado pela Task 14 (`App.tsx`).

- [ ] **Step 1: Escrever o teste**

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogManager } from "./CatalogManager";

beforeEach(() => {
  localStorage.clear();
});

describe("CatalogManager", () => {
  it("lista as máquinas do catálogo seed", () => {
    render(<CatalogManager onClose={() => {}} />);
    expect(screen.getByText(/Speed Queen Stack/)).toBeInTheDocument();
    expect(screen.getByText(/Mamute Smart 10/)).toBeInTheDocument();
    expect(screen.getByText(/Mamute Smart 17/)).toBeInTheDocument();
  });

  it("adiciona uma máquina nova preenchida no formulário", async () => {
    render(<CatalogManager onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("ID"), "custom-1");
    await userEvent.type(screen.getByLabelText("Marca"), "Teste");
    await userEvent.type(screen.getByLabelText("Modelo"), "Modelo X");
    await userEvent.type(screen.getByLabelText(/largura/i), "700");
    await userEvent.type(screen.getByLabelText(/profundidade/i), "800");
    await userEvent.type(screen.getByLabelText(/altura/i), "2000");
    await userEvent.click(screen.getByRole("button", { name: /adicionar/i }));

    expect(screen.getByText(/Teste Modelo X/)).toBeInTheDocument();
  });

  it("remove uma máquina ao clicar em remover", async () => {
    render(<CatalogManager onClose={() => {}} />);
    const items = screen.getAllByRole("listitem");
    const firstRemoveButton = items[0].querySelector("button");
    await userEvent.click(firstRemoveButton!);
    expect(screen.getAllByRole("listitem")).toHaveLength(items.length - 1);
  });

  it("chama onClose ao clicar em Fechar", async () => {
    const onClose = vi.fn();
    render(<CatalogManager onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/ui/CatalogManager.test.tsx`
Expected: FAIL — módulo `./CatalogManager` não existe.

- [ ] **Step 3: Implementar `app/src/ui/CatalogManager.tsx`**

```tsx
import { useState, useSyncExternalStore, type ChangeEvent } from "react";
import {
  addMachine,
  deleteMachine,
  exportCatalogJSON,
  getCatalog,
  importCatalogJSON,
  restoreDefaults,
  subscribeCatalog,
} from "../catalog/store";
import type { CatalogMachine } from "../engine/types";

const emptyMachine: CatalogMachine = {
  id: "",
  brand: "",
  model: "",
  type: "stack",
  widthMm: 0,
  depthMm: 0,
  heightMm: 0,
};

export function CatalogManager({ onClose }: { onClose: () => void }) {
  const catalog = useSyncExternalStore(subscribeCatalog, getCatalog);
  const [draft, setDraft] = useState<CatalogMachine>(emptyMachine);

  function handleAdd(): void {
    if (!draft.id || !draft.brand || !draft.model) return;
    addMachine(draft);
    setDraft(emptyMachine);
  }

  function handleImport(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => importCatalogJSON(text));
  }

  function handleExport(): void {
    const json = exportCatalogJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "catalogo-maquinas.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div role="dialog" aria-label="Gerenciar catálogo de máquinas">
      <button type="button" onClick={onClose}>
        Fechar
      </button>
      <button type="button" onClick={() => restoreDefaults()}>
        Restaurar padrão
      </button>
      <button type="button" onClick={handleExport}>
        Exportar JSON
      </button>
      <label>
        Importar JSON
        <input type="file" accept="application/json" onChange={handleImport} />
      </label>

      <ul>
        {catalog.map((m) => (
          <li key={m.id}>
            {m.brand} {m.model} — {m.widthMm}×{m.depthMm}×{m.heightMm}mm
            <button type="button" onClick={() => deleteMachine(m.id)}>
              Remover
            </button>
          </li>
        ))}
      </ul>

      <fieldset>
        <legend>Nova máquina</legend>
        <label>
          ID
          <input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
        </label>
        <label>
          Marca
          <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
        </label>
        <label>
          Modelo
          <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
        </label>
        <label>
          Largura (mm)
          <input
            type="number"
            value={draft.widthMm}
            onChange={(e) => setDraft({ ...draft, widthMm: Number(e.target.value) })}
          />
        </label>
        <label>
          Profundidade (mm)
          <input
            type="number"
            value={draft.depthMm}
            onChange={(e) => setDraft({ ...draft, depthMm: Number(e.target.value) })}
          />
        </label>
        <label>
          Altura (mm)
          <input
            type="number"
            value={draft.heightMm}
            onChange={(e) => setDraft({ ...draft, heightMm: Number(e.target.value) })}
          />
        </label>
        <button type="button" onClick={handleAdd}>
          Adicionar
        </button>
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que todos os testes passam**

Run: `cd app && npx vitest run src/ui/CatalogManager.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/ui/CatalogManager.tsx app/src/ui/CatalogManager.test.tsx
git commit -m "feat(ui): gerenciador de catalogo com CRUD, restaurar padrao e import/export JSON"
```

---

## Task 14: `App.tsx` — wiring final

**Files:**
- Modify: `app/src/App.tsx`
- Test: `app/src/App.test.tsx`
- Modify: `app/src/App.css` (ou remover se não usado — ver Step 5)

**Interfaces:**
- Consumes: `useLayout` de `./state/useLayout`; `ControlPanel`, `ViolationsPanel`, `CatalogManager` de `./ui/*`; `FloorPlan` de `./viewer2d/FloorPlan`; `Scene` de `./viewer3d/Scene`; `exportFloorPlanPNG`, `exportFloorPlanPDF` de `./export/export2d`; `exportSceneScreenshot` de `./export/export3d`.
- Produces: componente `App` renderizado em `main.tsx` — ponto de entrada final da aplicação.

- [ ] **Step 1: Escrever o teste de integração**

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { useProjectStore } from "./state/projectStore";

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({
    roomWidthMm: 5000,
    roomDepthMm: 4200,
    ceilingHeightMm: 2400,
    machines: [{ catalogId: "sq-stack", qty: 2 }],
    doorEnabled: true,
    techAccessSide: "right",
    furnitureEnabled: true,
    acOverrideBTU: null,
  });
});

describe("App", () => {
  it("renderiza a planta 2D por padrão sem violações para um estado válido", () => {
    render(<App />);
    expect(screen.getByRole("img", { name: /planta baixa/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra o painel de violações quando o estado é inválido", () => {
    useProjectStore.setState({ roomWidthMm: 500 });
    render(<App />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("troca para a aba 3D ao clicar em Planta 3D", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<App />);
    await userEvent.setup().click(screen.getByRole("button", { name: /planta 3d/i }));
    expect(screen.getByRole("button", { name: /baixar imagem 3d/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd app && npx vitest run src/App.test.tsx`
Expected: FAIL — `App` ainda não exporta esse comportamento (o template Vite gera um App diferente).

- [ ] **Step 3: Implementar `app/src/App.tsx`**

```tsx
import { useState } from "react";
import { ControlPanel } from "./ui/ControlPanel";
import { ViolationsPanel } from "./ui/ViolationsPanel";
import { CatalogManager } from "./ui/CatalogManager";
import { FloorPlan } from "./viewer2d/FloorPlan";
import { Scene } from "./viewer3d/Scene";
import { useLayout } from "./state/useLayout";
import { exportFloorPlanPDF, exportFloorPlanPNG } from "./export/export2d";
import { exportSceneScreenshot } from "./export/export3d";

export function App() {
  const { layout, violations } = useLayout();
  const [tab, setTab] = useState<"2d" | "3d">("2d");
  const [showCatalog, setShowCatalog] = useState(false);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  const canExport = layout !== null && violations.length === 0;

  return (
    <div className="app">
      <ControlPanel />
      <ViolationsPanel violations={violations} />

      <button type="button" onClick={() => setShowCatalog(true)}>
        Gerenciar máquinas
      </button>
      {showCatalog && <CatalogManager onClose={() => setShowCatalog(false)} />}

      <nav>
        <button type="button" onClick={() => setTab("2d")}>
          Planta 2D
        </button>
        <button type="button" onClick={() => setTab("3d")}>
          Planta 3D
        </button>
      </nav>

      {!layout && <p>Ajuste as dimensões para visualizar a planta.</p>}

      {layout && tab === "2d" && (
        <>
          <FloorPlan ref={setSvgEl} layout={layout} />
          <button
            type="button"
            disabled={!canExport || !svgEl}
            onClick={() => svgEl && exportFloorPlanPNG(svgEl)}
          >
            Baixar PNG
          </button>
          <button
            type="button"
            disabled={!canExport || !svgEl}
            onClick={() =>
              svgEl &&
              exportFloorPlanPDF(svgEl, {
                projectName: "Minha Lavanderia",
                areaM2: (layout.roomWidthMm / 1000) * (layout.roomDepthMm / 1000),
              })
            }
          >
            Baixar PDF
          </button>
        </>
      )}

      {layout && tab === "3d" && (
        <>
          <Scene layout={layout} onCanvasReady={setCanvasEl} />
          <button
            type="button"
            disabled={!canExport || !canvasEl}
            onClick={() => canvasEl && exportSceneScreenshot(canvasEl)}
          >
            Baixar imagem 3D
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que todos os testes passam**

Run: `cd app && npx vitest run src/App.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Ajustar `main.tsx` e remover CSS de boilerplate do template**

Editar `app/src/main.tsx` para garantir que renderiza `<App />` (geralmente já é o padrão do template — só confirmar o import). Abrir `app/src/App.css` e `app/src/index.css`: remover regras do boilerplate do Vite (logo girando, contagem de cliques) que não se aplicam; deixar `index.css` só com um reset básico (`box-sizing: border-box`, `margin: 0` no body) e `App.css` com um layout simples em flex/grid para o painel lateral + área de visualização.

- [ ] **Step 6: Rodar a suíte inteira do projeto**

Run: `cd app && npm test`
Expected: PASS em todos os arquivos de teste criados até aqui.

- [ ] **Step 7: Commit**

```bash
cd /home/seidor/Documents/lavanderia
git add app/src/App.tsx app/src/App.test.tsx app/src/main.tsx app/src/App.css app/src/index.css
git commit -m "feat(app): integra painel, catalogo, viewers 2D/3D e exportacao no App principal"
```

---

## Task 15: Verificação manual (QA) e checklist final

**Files:**
- Nenhum arquivo novo — task de verificação.

**Interfaces:**
- Consumes: aplicação completa das Tasks 1-14.
- Produces: confirmação de que os itens não cobertos por teste automatizado (animação 3D, rasterização SVG→PNG real, geração de PDF real) funcionam de fato no navegador.

- [ ] **Step 1: Rodar a build de produção**

Run: `cd app && npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: Subir o servidor de desenvolvimento**

Run: `cd app && npm run dev`
Expected: servidor sobe em `http://localhost:5173` (ou porta informada no terminal).

- [ ] **Step 3: Checklist manual no navegador**

Abrir a URL do dev server e confirmar, um a um:
- Alterar largura/profundidade/pé-direito recalcula a planta 2D e 3D imediatamente (com debounce suave, sem travar o campo).
- Reduzir a largura abaixo do mínimo mostra o aviso de violação com o valor sugerido; clicar em "Aplicar sugestão" corrige o campo e o aviso some.
- Trocar a quantidade/tipo de máquina reflete nas duas plantas.
- Alternar "Lado de acesso técnico" entre esquerda/direita move o corredor técnico e o totem para o lado correto.
- Alternar "Porta frontal" mostra/esconde o arco de abertura na parede da frente da planta 2D.
- Com mobiliário habilitado, mesa + 3 cadeiras + totem + ar-condicionado aparecem nas duas plantas.
- Na aba 3D: orbitar a câmera funciona com inércia suave; ao mudar a quantidade de máquinas, as caixas se movem suavemente (não "pulam" de posição).
- Botão "Baixar PNG" (2D) baixa um arquivo PNG não vazio, visualmente correto.
- Botão "Baixar PDF" (2D) baixa um PDF com a planta, cotas, nome do projeto e data.
- Botão "Baixar imagem 3D" baixa um PNG com a cena 3D atual.
- Abrir "Gerenciar máquinas", adicionar uma máquina custom, selecioná-la no painel de controle e confirmar que ela aparece nas plantas.
- Exportar o catálogo em JSON, apagar uma máquina, reimportar o JSON exportado e confirmar que ela volta.
- Recarregar a página (F5): catálogo editado permanece (persistido via localStorage).
- Testar em largura de tela estreita (~400px, modo responsivo do navegador): painel de controle continua utilizável, sem scroll horizontal da página.

- [ ] **Step 4: Registrar o resultado**

Se algum item do checklist falhar, abrir uma task de correção específica (não documentada aqui, pois depende do que falhar) antes de considerar o plano concluído. Se tudo passar, o plano está completo.

- [ ] **Step 5: Commit final (se houver ajustes do checklist)**

```bash
cd /home/seidor/Documents/lavanderia
git add -A
git commit -m "chore: ajustes finais apos checklist manual de QA"
```

---

## Fora de escopo (lembrete do spec)

Não implementar neste plano: layout em L (estouro automático para parede lateral), posicionamento livre por arrasto, backend/compartilhamento de projetos, export GLTF do modelo 3D. Esses itens estão registrados na seção 9 do spec como v2.
