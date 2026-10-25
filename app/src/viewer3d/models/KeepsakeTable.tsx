import { DoubleSide } from "three";
import { StdMat } from "./SharedMaterial";

// Portado de Potes mesa.html. Mesa de madeira com toalha azul-clara e 10
// frascos de líquido azul (2 fileiras de 5), as lembranças da inauguração.
// Origem no centro da base. Modelo em unidades arbitrárias; SCALE leva pra
// metros (~0,84 x 0,56 m, tampo a ~0,87 m).
const SCALE = 0.28;

const TOP_Y = 3.1;
const CLOTH_TOP_Y = 3.21;
const CLOTH_DROP = 1.5;
const BOTTLE_COLS = 5;
const BOTTLE_SPACING = 0.45;
const BOTTLE_TILTS = [0.12, -0.2, 0.05, 0.22, -0.1, -0.15, 0.18, -0.05, 0.1, -0.22];

function Wood() {
  return <StdMat color="#d2b48c" roughness={0.8} />;
}

function Cloth() {
  return <StdMat color="#cce6ff" roughness={0.9} side={DoubleSide} />;
}

function Bottle({ x, z, tilt }: { x: number; z: number; tilt: number }) {
  return (
    <group position={[x, CLOTH_TOP_Y, z]} rotation={[0, tilt, 0]}>
      <mesh position={[0, 0.175, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.35, 24]} />
        <StdMat color="#ffffff" transparent opacity={0.3} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.105, 0.105, 0.3, 24]} />
        <StdMat color="#2288ff" transparent opacity={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.1, 16]} />
        <StdMat color="#ffffff" transparent opacity={0.3} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 16]} />
        <Wood />
      </mesh>
    </group>
  );
}

export function KeepsakeTable() {
  const dropY = CLOTH_TOP_Y - CLOTH_DROP / 2;
  const startX = -((BOTTLE_COLS - 1) * BOTTLE_SPACING) / 2;

  return (
    <group scale={SCALE}>
      <mesh position={[0, TOP_Y, 0]} castShadow>
        <boxGeometry args={[3, 0.2, 2]} />
        <Wood />
      </mesh>
      {([[1.3, 0.8], [-1.3, 0.8], [1.3, -0.8], [-1.3, -0.8]] as const).map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 1.5, z]} castShadow>
          <boxGeometry args={[0.2, 3, 0.2]} />
          <Wood />
        </mesh>
      ))}

      {/* Toalha: tampo + 4 abas caídas */}
      <mesh position={[0, CLOTH_TOP_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.2, 2.2]} />
        <Cloth />
      </mesh>
      <mesh position={[0, dropY, 1.1]} castShadow>
        <planeGeometry args={[3.2, CLOTH_DROP]} />
        <Cloth />
      </mesh>
      <mesh position={[0, dropY, -1.1]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3.2, CLOTH_DROP]} />
        <Cloth />
      </mesh>
      <mesh position={[1.6, dropY, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[2.2, CLOTH_DROP]} />
        <Cloth />
      </mesh>
      <mesh position={[-1.6, dropY, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, CLOTH_DROP]} />
        <Cloth />
      </mesh>

      {[-0.25, 0.25].flatMap((z, row) =>
        Array.from({ length: BOTTLE_COLS }, (_, col) => (
          <Bottle
            key={`${row}-${col}`}
            x={startX + col * BOTTLE_SPACING}
            z={z}
            tilt={BOTTLE_TILTS[row * BOTTLE_COLS + col]}
          />
        ))
      )}
    </group>
  );
}
