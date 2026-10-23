// Portado de html-3d/Quadro energia.html: quadro de distribuição de embutir —
// caixa escura embutida, moldura branca, 2 trilhos DIN (em cima DR + geral
// trifásico + tampas cegas; embaixo 11 disjuntores unipolares) e porta de
// acrílico fumê FECHADA (no modelo ela abria 140°; aqui ficaria no corredor).
// Unidades do modelo; PANEL_SCALE leva pra metros (~0,40 x 0,50 m). Frente
// pra +z; a caixa (z < 0) fica dentro da parede.
export const PANEL_SCALE = 0.18;
export const PANEL_SIZE_M = { width: 2.2 * PANEL_SCALE, height: 2.8 * PANEL_SCALE };

const PANEL_W = 2.2;
const PANEL_H = 2.8;
const PANEL_D = 0.35;
const FRAME_T = 0.06;
const ROW_Y = [0.65, -0.55];

const WHITE = { color: "#f5f5f7", roughness: 0.35, metalness: 0.05 } as const;
const INNER = { color: "#22252a", roughness: 0.6, metalness: 0.2 } as const;
const RAIL = { color: "#b0b5bc", roughness: 0.3, metalness: 0.2 } as const;
const BREAKER = { color: "#efeff1", roughness: 0.4, metalness: 0.05 } as const;
const BLUE = { color: "#0055aa", roughness: 0.3, metalness: 0.1 } as const;
const RED = { color: "#d32f2f", roughness: 0.3, metalness: 0.1 } as const;
const YELLOW = { color: "#fbc02d", roughness: 0.3, metalness: 0.1 } as const;

type MatProps = { color: string; roughness?: number; metalness?: number };

function Block({ args, mat, position, rotation }: {
  args: [number, number, number];
  mat: MatProps;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

// Módulo de disjuntor: corpo, degrau frontal, alavanca azul ligada (pra
// cima); o DR tem botão de teste amarelo e janelinha vermelha.
function Breaker({ width, dr = false, position }: { width: number; dr?: boolean; position: [number, number, number] }) {
  const d = 0.22;
  const h = 0.52;
  return (
    <group position={position}>
      <Block args={[width, h, d]} mat={BREAKER} />
      <Block args={[width * 0.96, h * 0.65, 0.05]} mat={BREAKER} position={[0, 0, d / 2 + 0.025]} />
      <Block args={[width * 0.4, 0.18, 0.04]} mat={INNER} position={[0, 0.05, d / 2 + 0.051]} />
      <Block args={[width * 0.32, 0.09, 0.08]} mat={BLUE} position={[0, 0.07, d / 2 + 0.08]} rotation={[-0.35, 0, 0]} />
      {dr && (
        <>
          <mesh position={[-width * 0.25, -0.12, d / 2 + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.03, 16]} />
            <meshStandardMaterial {...YELLOW} />
          </mesh>
          <Block args={[0.04, 0.03, 0.01]} mat={RED} position={[width * 0.25, -0.12, d / 2 + 0.05]} />
        </>
      )}
    </group>
  );
}

export function ElectricalPanel() {
  const z = PANEL_D / 2 + FRAME_T + 0.12; // face dos disjuntores
  const pole = 0.11;
  const mcb = 0.108;
  const gap = 0.004;
  const startX = -(11 * (mcb + gap)) / 2 + mcb / 2;
  // a moldura fica rente à parede: tudo recua pra a caixa entrar nela
  return (
    <group scale={PANEL_SCALE} position={[0, 0, -(PANEL_D / 2) * PANEL_SCALE]}>
      <Block args={[PANEL_W - 0.1, PANEL_H - 0.1, PANEL_D]} mat={INNER} />
      <Block args={[PANEL_W, PANEL_H, FRAME_T]} mat={WHITE} position={[0, 0, PANEL_D / 2 + FRAME_T / 2]} />
      <mesh position={[0, 0, PANEL_D / 2 + FRAME_T + 0.001]}>
        <planeGeometry args={[PANEL_W - 0.3, PANEL_H - 0.3]} />
        <meshStandardMaterial {...INNER} />
      </mesh>
      {ROW_Y.map((y) => (
        <Block key={y} args={[1.7, 0.08, 0.03]} mat={RAIL} position={[0, y, PANEL_D / 2 + FRAME_T + 0.02]} />
      ))}

      {/* Fila de cima: DR, geral trifásico (3 polos + barra) e tampas cegas */}
      <Breaker width={0.38} dr position={[-0.62, ROW_Y[0], z]} />
      <group position={[-0.12, ROW_Y[0], z]}>
        {[-1, 0, 1].map((k) => (
          <Breaker key={k} width={pole} position={[k * (pole + 0.005), 0, 0]} />
        ))}
        <Block args={[pole * 2.8, 0.03, 0.04]} mat={BLUE} position={[0, 0.07, 0.11 + 0.08]} rotation={[-0.35, 0, 0]} />
      </group>
      <Block args={[0.55, 0.45, 0.04]} mat={WHITE} position={[0.48, ROW_Y[0], z - 0.06]} />

      {/* Fila de baixo: 11 disjuntores unipolares */}
      {Array.from({ length: 11 }, (_, i) => (
        <Breaker key={i} width={mcb} position={[startX + i * (mcb + gap), ROW_Y[1], z]} />
      ))}

      {/* Porta de acrílico fumê, fechada, com puxador à direita */}
      <group position={[0, 0, PANEL_D / 2 + FRAME_T + 0.3]}>
        <mesh>
          <boxGeometry args={[PANEL_W * 0.98, PANEL_H * 0.98, 0.05]} />
          <meshStandardMaterial color="#e8ebef" roughness={0.15} metalness={0.05} transparent opacity={0.35} depthWrite={false} />
        </mesh>
        <Block args={[0.04, 0.35, 0.04]} mat={WHITE} position={[PANEL_W * 0.98 / 2 - 0.06, 0, 0.045]} />
      </group>
    </group>
  );
}
