import { useMemo } from "react";
import { LatheGeometry, Vector2 } from "three";

// Poof redondo estofado: cilindro com bordas arredondadas, girado a partir de um perfil.
// Medidas reais em metros (Ø50cm x 42cm), origem no centro da base.
const RADIUS = 0.25;
const HEIGHT = 0.42;
const CORNER = 0.07;

function buildProfile(): Vector2[] {
  const points: Vector2[] = [new Vector2(0, 0)];
  const arc = (cx: number, cy: number, from: number, to: number) => {
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      points.push(new Vector2(cx + Math.cos(a) * CORNER, cy + Math.sin(a) * CORNER));
    }
  };
  arc(RADIUS - CORNER, CORNER, -Math.PI / 2, 0); // canto de baixo
  arc(RADIUS - CORNER, HEIGHT - CORNER, 0, Math.PI / 2); // canto de cima
  points.push(new Vector2(0, HEIGHT));
  return points;
}

export function Pouf() {
  const geometry = useMemo(() => new LatheGeometry(buildProfile(), 40), []);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#64748b" roughness={0.95} metalness={0} />
      </mesh>
      {/* Costura no topo */}
      <mesh position={[0, HEIGHT - 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RADIUS - CORNER - 0.01, 0.005, 6, 40]} />
        <meshStandardMaterial color="#475569" roughness={1} />
      </mesh>
    </group>
  );
}
