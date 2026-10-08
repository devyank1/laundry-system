# Configurador de Lavanderia — Planta 2D/3D Paramétrica

Data: 2026-10-08
Status: Aprovado para implementação

## 1. Contexto e objetivo

Site/configurador onde o cliente define, a qualquer momento, a área (m²),
largura, profundidade e pé-direito de uma lavanderia de autoatendimento, e
escolhe quantidade e tipo de máquinas a partir de um catálogo. O sistema
calcula automaticamente um layout válido (sem o cliente arrastar nada
manualmente), respeitando as restrições técnicas do maquinário e das
instalações, gera uma planta 3D navegável e uma planta 2D com cotas, e
permite baixar ambas.

Não existe "modelo de planta fixo" para escolher — o layout é sempre
recalculado a partir dos parâmetros escolhidos pelo cliente, dentro das
regras mínimas abaixo.

## 2. Dados de origem (documentos fornecidos)

Extraídos de `Ebook de Instalação Évora - SSU SSG.pdf`, `EBOOK de Instalação
Évora - Stack Elétrica.pdf`, `Ficha Técnica - Smart 10 (1).pdf`, `Ficha
Técnica Industrial - Smart 17 (3).pdf`, `VALORES TOTAIS LAVANDERIA.xlsx`,
`Execução Projeto.xlsx`, `Links lavanderia Mentorado.xlsx`.

### 2.1 Catálogo seed de máquinas

| id | Marca/Modelo | Tipo | Largura×Profund.×Altura (mm) | Disjuntor | Cabo | Exaustor | Dreno |
|---|---|---|---|---|---|---|---|
| `sq-stack` | Speed Queen Stack Elétrica (SSU/SSG) | stack (lavadora+secadora) | 683 × 794 × 1986 | lavadora 16A bipolar · secadora 32A steck 2P+T | secadora 6mm² (≤4,5m) ou 10mm² (>4,5m) | duto compartilhado, curva 90° alongada atrás + trechos 45° | 14 L/min por máquina no coletor |
| `mamute-smart10` | Mamute Smart 10 (stack) | stack | 680 × 880 × 2040 | lavadora 16A (2×2,5mm²) · secadora 40A (2×10mm²) | Ø100mm | dreno 2", água Ø3/4" |
| `mamute-smart17` | Mamute Smart 17 (stack) | stack | 835 × 1190 × 2210 | — (verificar com fornecedor) | Ø150mm | dreno Ø3", água Ø3/4" |

Catálogo é editável pelo usuário (CRUD completo) e persiste em
`localStorage`; os 3 registros acima são o seed padrão restaurável. Import
e export em JSON para portar entre navegadores/lojas.

### 2.2 Regras técnicas obrigatórias (confirmadas com o usuário)

- **Área técnica traseira**: 1,00m a 1,10m entre a parede de fundo e a
  traseira do maquinário (ajustada pelo usuário a partir do documento, que
  citava 20-50cm para outro cenário — vale o valor confirmado: 1,00–1,10m).
- **Lateral livre**: 50cm de cada lado, da parede lateral até o
  maquinário.
- **Drywall**: coplanar com a face frontal das máquinas (não recuado).
  Vãos recortados apenas nas posições de carga/descarga de cada máquina.
- **Totem de pagamento**: fica no salão (lado do cliente), encostado na
  linha do drywall, dentro da faixa lateral de 50cm do lado escolhido para
  acesso técnico. Sem recorte/nicho no drywall — é mobiliário solto
  encostado na parede/drywall.
- **Pé-direito mínimo**: altura da máquina mais alta + 30cm de folga (duto
  de exaustão / manutenção, conforme Ebook Évora).
- **Folga de cabo**: 30cm de folga de cabeamento atrás da máquina
  (informativo na planta técnica, não altera geometria da sala).
- **Dreno**: 14 L/min por máquina — informativo (aparece na ficha técnica
  exportada, não afeta geometria).

### 2.3 Recomendação de BTU (ar-condicionado)

Fórmula usada pelo motor:

```
BTU_min = área_m² × 600 + qtd_secadoras × 2000
```

Arredondado para cima para o tamanho comercial mais próximo:
9.000 / 12.000 / 18.000 / 22.000 / 30.000 / 36.000 / 48.000 / 60.000 BTU/h.

| Área (m²) | BTU base (~600/m²) | Capacidade comercial sugerida |
|---|---|---|
| até 12 | 7.200 | 9.000 |
| 13–17 | 9.600–10.200 | 12.000 |
| 18–22 | 10.800–13.200 | 18.000 |
| 23–28 | 13.800–16.800 | 18.000–22.000 |
| 29–35 | 17.400–21.000 | 22.000 |
| 36–45 | 21.600–27.000 | 30.000 |

O valor sugerido é editável — o usuário pode forçar outra capacidade.

## 3. Stack técnica

React 18 + TypeScript + Vite. Estado global em Zustand. 3D com Three.js via
`@react-three/fiber` + `@react-three/drei` (OrbitControls). 2D em SVG nativo
do React. Sem backend — aplicação 100% client-side, deploy estático.
Catálogo e projetos salvos em `localStorage`, com export/import em JSON.

Justificativa: não há necessidade de múltiplos usuários, login ou
persistência compartilhada agora; SPA estática é mais simples de construir,
hospedar e manter. Se no futuro for preciso compartilhar projetos por link
entre lojas, adiciona-se backend sem reescrever o motor (ele é puro e
independente de UI).

## 4. Arquitetura / componentes

```
src/
  engine/           # funções puras, sem React nem Three — 100% testável
    layout.ts        # calcula posições de máquinas, drywall, corredor,
                      # mobiliário a partir do ProjectState + catálogo
    constraints.ts    # valida regras, gera violations[] com sugestão
    btu.ts            # fórmula de BTU
    types.ts
  catalog/
    seed.ts           # 3 máquinas reais
    store.ts           # CRUD + persistência localStorage + import/export
  state/
    projectStore.ts    # Zustand: dimensões, máquinas escolhidas, porta,
                        # lado de acesso técnico, mobiliário, override BTU
  viewer3d/
    Scene.tsx           # sala, máquinas, drywall com vãos, mobiliário, luz
    CameraRig.tsx        # OrbitControls + animação de transição
  viewer2d/
    FloorPlan.tsx        # planta SVG com cotas, legenda, escala
  export/
    export2d.ts          # SVG -> PNG / PDF
    export3d.ts          # canvas -> PNG (screenshot alta resolução)
  ui/
    ControlPanel.tsx      # inputs de dimensões, stepper de máquinas, toggles
    ViolationsPanel.tsx    # mensagens de erro com botão "aplicar sugestão"
    CatalogManager.tsx      # modal CRUD do catálogo
  App.tsx
```

### 4.1 Fluxo de dados

Fonte única de verdade: `ProjectState` (Zustand).

```ts
type ProjectState = {
  roomWidth: number;      // mm
  roomDepth: number;      // mm
  ceilingHeight: number;  // mm
  machines: { catalogId: string; qty: number }[];
  doorEnabled: boolean;
  techAccessSide: "left" | "right";
  furnitureEnabled: boolean; // mesa+3 cadeiras+totem+ar-condicionado
  acOverrideBTU?: number;
};
```

Toda alteração do `ProjectState` chama `engine.computeLayout(state,
catalog)` (pura), que devolve:

```ts
type LayoutResult = {
  layout: {
    machines: PlacedMachine[];   // posição/rotação de cada máquina
    drywall: { openings: Rect[]; height: number };
    techCorridor: Rect;
    furniture: { table: Rect; chairs: Rect[]; totem: Rect; ac: Rect };
    acSuggestedBTU: number;
  } | null;
  violations: Violation[];  // vazio quando válido
};

type Violation = {
  code: string;
  message: string;           // texto claro em português
  field: keyof ProjectState; // campo a corrigir
  suggestedValue: number;
};
```

`viewer3d` e `viewer2d` renderizam **sempre** a partir do mesmo `layout` —
garante que a planta 3D e a 2D nunca divergem. Se `layout` for `null`
(violações impedem cálculo), os viewers mostram um placeholder "ajuste as
dimensões" e o `ViolationsPanel` lista os problemas com botão "aplicar
sugestão" que corrige o campo automaticamente.

### 4.2 Algoritmo de layout (fileira única + validação)

1. Soma largura de todas as máquinas escolhidas + gap de 2cm entre elas →
   `larguraFileira`.
2. `larguraMinSala = larguraFileira + 500 + 500` (laterais). Se
   `roomWidth` menor, gera violação com a largura mínima sugerida.
3. `profundidadeMinSala = profundidadeMaxMaquina + areaTecnica(1000 a 1100,
   padrão 1050) + profundidadeMinSalao(1800)`. Se `roomDepth` menor, gera
   violação.
4. `peDireitoMin = alturaMaxMaquina + 300`. Se `ceilingHeight` menor, gera
   violação.
5. Máquinas posicionadas em fileira ao longo da parede de fundo, começando
   do lado oposto ao `techAccessSide` (o lado escolhido fica livre para
   corredor + totem).
6. Drywall: polígono na mesma linha da frente das máquinas, vãos recortados
   nas larguras/alturas de cada máquina.
7. Corredor técnico: retângulo de 50cm no lado escolhido, do drywall até a
   parede de fundo — é a abertura de acesso à área técnica.
8. Totem: posicionado no salão, encostado na linha do drywall, dentro da
   projeção da faixa de 50cm do `techAccessSide`.
9. Mesa + 3 cadeiras: posicionadas no espaço restante do salão (centralizado
   ou próximo à porta). Se não couber, gera violação sugerindo profundidade
   mínima maior.
10. Ar-condicionado: parede lateral ou acima do drywall; BTU sugerido pela
    fórmula da seção 2.3, editável via `acOverrideBTU`.
11. Porta frontal (opcional): abertura na parede da frente, posição
    centralizada por padrão.

Extensão futura (v2, fora do escopo deste spec): quando a fileira não
couber na largura escolhida, estourar automaticamente para uma parede
lateral (formato L). Registrado aqui para não ser esquecido, não
implementado agora.

## 5. Interface e animações

Linguagem visual simples e leve: poucos cliques, inputs numéricos + slider
sincronizados (debounce ~150ms antes de recalcular, para não travar durante
o arraste). Toast leve (não-bloqueante) para violações, com botão "aplicar
sugestão".

Animações:
- Interpolação suave (~400ms) da posição de máquinas/mobiliário quando o
  layout recalcula — nada "pula" de posição.
- Câmera orbital com inércia suave (`@react-three/drei` `OrbitControls`
  com damping).
- Fade/scale leve ao adicionar/remover máquina do catálogo.

Responsivo: em telas pequenas o painel de controle vira acordeão e o viewer
3D fica sob demanda (2D é o padrão em mobile, por custo de performance).

## 6. Exportação

- **Planta 2D**: botão "Baixar PNG" (SVG renderizado em canvas) e "Baixar
  PDF" (mesmo conteúdo em página A3/A4 com cotas, legenda, escala, nome do
  projeto e data).
- **Planta 3D**: botão "Baixar imagem 3D" — screenshot do canvas em alta
  resolução (PNG). Export de modelo 3D (GLTF) fica registrado como
  melhoria futura (v2), não bloqueia este escopo.
- Botões de download ficam desabilitados enquanto houver violações.

## 7. Tratamento de erro

O motor nunca lança exceção por combinação inválida de parâmetros — sempre
devolve `violations[]` com mensagem clara, campo responsável e valor
mínimo sugerido. A UI nunca trava durante digitação; o cálculo roda em cada
mudança (com debounce) e mostra o estado mais recente válido ou os erros
atuais.

## 8. Testes

- **Vitest** em `src/engine/`: largura/profundidade/pé-direito mínimos,
  posição dos vãos do drywall, fórmula de BTU, violação quando mobiliário
  não cabe, restauração do catálogo seed.
- **Smoke tests** (Testing Library) nos componentes de UI e nos viewers —
  garantem que renderizam sem quebrar para um conjunto de estados válidos e
  inválidos; sem verificação pixel-a-pixel do 3D.

## 9. Fora de escopo (v2 / futuro)

- Layout em L (estouro automático para parede lateral).
- Posicionamento livre por arrasto (drag-and-drop).
- Backend/compartilhamento de projetos por link, múltiplos usuários.
- Export GLTF do modelo 3D.
