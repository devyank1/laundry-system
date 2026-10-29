import { cachedCanvasTexture } from "./canvasTexture";
import { BasicMat, StdMat } from "./SharedMaterial";
import { Black, QuantumBezel, Steel, drawQuantumScreen, drawSqBadge } from "./SpeedQueenSyc";

// Secadora Speed Queen ST055 (folheto Secadoras_SUS30_ST035-75): gabinete
// inox alto, faixa de comando no topo com logo à esquerda e tela Quantum
// numa moldura trapézio preta, porta redonda grande com aro cromado e a aba
// da dobradiça à direita. Medidas nativas em metros (870 × 1350 × 1700 mm),
// origem no centro da base, frente voltada para +z.
const W = 0.87;
const H = 1.7;
const D = 1.35;

const FRONT = D / 2;

// Medidas tiradas da foto de detalhe (~1 mm/px).
const SEAM_Y = 1.43; // fim da faixa de comando
const SCREEN_Y = 1.53;
const DOOR_Y = 0.97;
const DOOR_R = 0.33;

export function SpeedQueenSt() {
  const screen = cachedCanvasTexture("st-screen", 256, 144, (ctx) => drawQuantumScreen(ctx, "#ef4444", "21"));
  const badge = cachedCanvasTexture("sq-badge", 256, 48, drawSqBadge);

  return (
    <group>
      {/* Gabinete inox */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <Steel />
      </mesh>

      {/* Friso da faixa de comando e rodapé */}
      {[SEAM_Y, 0.1].map((y) => (
        <mesh key={y} position={[0, y, FRONT + 0.001]}>
          <boxGeometry args={[W + 0.002, 0.005, 0.004]} />
          <BasicMat color="#8f9398" />
        </mesh>
      ))}

      {/* Faixa de comando: logo, tela e fechadura */}
      <group position={[0, 0, FRONT]}>
        <QuantumBezel y={SCREEN_Y} width={0.245} height={0.12} screen={screen} />
      </group>
      <mesh position={[-0.27, SCREEN_Y, FRONT + 0.004]}>
        <planeGeometry args={[0.22, 0.042]} />
        <BasicMat map={badge} color={badge ? "#ffffff" : "#111111"} />
      </mesh>
      <mesh position={[0, H - 0.055, FRONT + 0.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
        <Black />
      </mesh>

      {/* Leitor de cartão à esquerda da porta */}
      <mesh position={[-0.38, 1.235, FRONT + 0.003]}>
        <boxGeometry args={[0.03, 0.015, 0.006]} />
        <Black />
      </mesh>

      {/* Porta: aro cromado, vedação preta, tambor e aba da dobradiça */}
      <group position={[0, DOOR_Y, FRONT]}>
        <mesh position={[0, 0, 0.014]} castShadow>
          <torusGeometry args={[DOOR_R - 0.012, 0.016, 14, 64]} />
          <StdMat color="#eef0f2" roughness={0.12} metalness={0.95} />
        </mesh>
        <mesh position={[0, 0, 0.008]}>
          <torusGeometry args={[DOOR_R - 0.04, 0.018, 12, 64]} />
          <Black />
        </mesh>
        <mesh position={[0, 0, 0.004]}>
          <circleGeometry args={[DOOR_R - 0.05, 48]} />
          <StdMat color="#6b6f74" roughness={0.25} metalness={0.6} />
        </mesh>
        <mesh position={[DOOR_R + 0.04, 0.17, 0.012]} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.02]} />
          <StdMat color="#f8fafc" roughness={0.35} metalness={0.1} />
        </mesh>
      </group>
    </group>
  );
}
