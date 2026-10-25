import { StdMat } from "./SharedMaterial";
// Portado de Lixo.html. Lixeira cilíndrica de inox escovado, base preta,
// aro superior e tampa basculante. Origem no centro da base, no chão. Modelo em
// unidades arbitrárias; SCALE leva pra metros (~0,32 m de diâmetro, ~0,55 m de altura).
const SCALE = 0.16;

const BODY_HEIGHT = 3.2;
const RIM_HEIGHT = 0.16;
const TOP_Y = 0.1 + BODY_HEIGHT + RIM_HEIGHT;

function Chrome({ color = "#c8cccf", roughness = 0.22 }: { color?: string; roughness?: number }) {
  return <StdMat color={color} metalness={0.6} roughness={roughness} />;
}

function BlackPlastic() {
  return <StdMat color="#1a1a1a" roughness={0.75} metalness={0.1} />;
}

export function TrashCan() {
  return (
    <group scale={SCALE}>
      {/* Base preta */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.02, 1.02, 0.1, 48]} />
        <BlackPlastic />
      </mesh>
      {/* Corpo de inox */}
      <mesh position={[0, 0.1 + BODY_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, BODY_HEIGHT, 48]} />
        <Chrome />
      </mesh>
      {/* Aro superior */}
      <mesh position={[0, 0.1 + BODY_HEIGHT + RIM_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[1.04, 1.04, RIM_HEIGHT, 48]} />
        <Chrome color="#dcdfe2" roughness={0.18} />
      </mesh>
      <mesh position={[0, TOP_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.96, 0.05, 12, 48]} />
        <BlackPlastic />
      </mesh>
      {/* Tampa basculante */}
      <group position={[0, TOP_Y, 0]} rotation={[0.12, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.94, 0.94, 0.03, 48]} />
          <Chrome />
        </mesh>
        <mesh position={[0, 0.018, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 1.92, 12]} />
          <BlackPlastic />
        </mesh>
      </group>
    </group>
  );
}
