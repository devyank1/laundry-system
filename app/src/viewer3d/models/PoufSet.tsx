import { useMemo } from "react";
import { CylinderGeometry, EdgesGeometry, ExtrudeGeometry, Shape } from "three";
import { StdMat } from "./SharedMaterial";

// Portado de pufs.html. Conjunto de 3 pufs hexagonais encaixados (azul-escuro na
// frente, azul-claro e verde-água atrás). Origem no centro da caixa de
// PUFS_SIZE_MM, no chão. Modelo em unidades arbitrárias; SCALE leva pra
// metros (raio 0,33 m, altura ~0,29 m).
const SCALE = 0.275;
const RADIUS = 1.2;
const HEIGHT = 1.05;
// Centro a centro de duas faces planas encostadas: raio * raiz(3).
const DIST = RADIUS * Math.sqrt(3);
// A nuvem toda cabe em x: ±1,73 R e z: -1,95 R..+1,55 R; recentra em z.
const CLOUD_CENTER_Z = (1.55 * RADIUS - 1.95 * RADIUS) / 2;

const POUFS = [
  { color: "#1e3a8a", x: 0, z: 0.55 * RADIUS },
  { color: "#7dc4f0", x: -DIST / 2, z: -0.95 * RADIUS },
  { color: "#5fd1c0", x: DIST / 2, z: -0.95 * RADIUS },
] as const;

function useHexGeometry() {
  return useMemo(() => {
    const shape = new Shape();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const x = RADIUS * Math.cos(a);
      const y = RADIUS * Math.sin(a);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const body = new ExtrudeGeometry(shape, {
      depth: HEIGHT - 0.1,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    });
    body.center();
    return {
      body,
      seam: new EdgesGeometry(body, 25),
      foot: new CylinderGeometry(RADIUS * 0.92, RADIUS * 0.9, 0.04, 6),
    };
  }, []);
}

function Pouf({ color, x, z }: { color: string; x: number; z: number }) {
  const geo = useHexGeometry();
  // Corpo centrado em y = 0 no modelo: sobe meia altura pra apoiar no chão.
  return (
    <group position={[x, HEIGHT / 2 + 0.04, z - CLOUD_CENTER_Z]}>
      <mesh geometry={geo.body} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <StdMat color={color} roughness={0.65} metalness={0.1} />
      </mesh>
      <lineSegments geometry={geo.seam} rotation={[Math.PI / 2, 0, 0]}>
        <lineBasicMaterial color="#000000" transparent opacity={0.15} />
      </lineSegments>
      <mesh geometry={geo.foot} position={[0, -HEIGHT / 2 - 0.02, 0]} rotation={[0, Math.PI / 6, 0]} receiveShadow>
        <StdMat color="#1a1a1a" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function PoufSet() {
  return (
    <group scale={SCALE}>
      {POUFS.map((p) => (
        <Pouf key={p.color} {...p} />
      ))}
    </group>
  );
}
