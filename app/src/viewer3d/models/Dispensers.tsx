import { useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

// Portado de dispensers_3d.html. Dispenser de papel toalha (topo arqueado) e
// de sabonete líquido, em plástico branco brilhante. Medidas nativas em
// metros; origem no ponto de contato com a parede (costas em z = 0, frente
// pra +z). Lado a lado (papel à esquerda, sabonete à direita), centrados em
// x = 0 e reduzidos pra caber no trecho estreito de drywall ao lado das máquinas.
const SCALE = 0.75;
const CENTER_X = 0.06; // centra o conjunto (de -0,34 a 0,22) em x = 0
const PAPER = { w: 0.28, h: 0.35, d: 0.12 };
const SOAP = { w: 0.14, h: 0.22, d: 0.1 };

function roundedRect(width: number, height: number, radius: number): Shape {
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x, y + radius);
  shape.lineTo(x, y + height - radius);
  shape.quadraticCurveTo(x, y + height, x + radius, y + height);
  shape.lineTo(x + width - radius, y + height);
  shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  shape.lineTo(x + width, y + radius);
  shape.quadraticCurveTo(x + width, y, x + width - radius, y);
  shape.lineTo(x + radius, y);
  shape.quadraticCurveTo(x, y, x, y + radius);
  return shape;
}

function useDispenserGeometries() {
  return useMemo(() => {
    const paperShape = new Shape();
    paperShape.moveTo(-PAPER.w / 2, -PAPER.h / 2);
    paperShape.lineTo(PAPER.w / 2, -PAPER.h / 2);
    paperShape.lineTo(PAPER.w / 2, PAPER.h / 2 - 0.05);
    paperShape.quadraticCurveTo(0, PAPER.h / 2 + 0.02, -PAPER.w / 2, PAPER.h / 2 - 0.05);
    paperShape.lineTo(-PAPER.w / 2, -PAPER.h / 2);

    const bevel = { bevelEnabled: true, bevelSegments: 4, bevelSteps: 2 };
    return {
      paper: new ExtrudeGeometry(paperShape, {
        ...bevel,
        depth: PAPER.d,
        bevelThickness: 0.015,
        bevelSize: 0.015,
      }),
      soap: new ExtrudeGeometry(roundedRect(SOAP.w, SOAP.h, 0.02), {
        ...bevel,
        depth: SOAP.d,
        bevelThickness: 0.01,
        bevelSize: 0.01,
      }),
      lever: new ExtrudeGeometry(roundedRect(SOAP.w * 0.7, 0.06, 0.01), {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.005,
      }),
    };
  }, []);
}

function Gloss() {
  return <meshPhysicalMaterial color="#ffffff" roughness={0.1} metalness={0.1} clearcoat={1} clearcoatRoughness={0.1} />;
}

function Window({ size, z }: { size: [number, number, number]; z: number }) {
  return (
    <mesh position={[0, 0, z]}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#050505" roughness={0.2} metalness={0.8} />
    </mesh>
  );
}

export function Dispensers() {
  const geo = useDispenserGeometries();

  return (
    <group scale={SCALE} position={[CENTER_X * SCALE, 0, 0]}>
      {/* Papel toalha (esquerda) */}
      <group position={[-0.2, 0, 0.015]}>
        <mesh geometry={geo.paper} castShadow receiveShadow>
          <Gloss />
        </mesh>
        <group position={[0, -0.08, PAPER.d + 0.015]}>
          <Window size={[0.015, 0.06, 0.01]} z={0} />
        </group>
        <mesh position={[0, -PAPER.h / 2 - 0.005, PAPER.d / 2]}>
          <boxGeometry args={[PAPER.w, 0.01, PAPER.d]} />
          <meshStandardMaterial color="#222222" roughness={0.8} metalness={0.1} />
        </mesh>
      </group>

      {/* Sabonete (direita, um pouco mais baixo) */}
      <group position={[0.15, -0.05, 0.01]}>
        <mesh geometry={geo.soap} castShadow receiveShadow>
          <Gloss />
        </mesh>
        <Window size={[0.015, 0.05, 0.01]} z={SOAP.d + 0.01} />
        <mesh
          geometry={geo.lever}
          position={[0, -SOAP.h / 2 - 0.01, SOAP.d - 0.02]}
          rotation={[-0.2, 0, 0]}
          castShadow
        >
          <Gloss />
        </mesh>
      </group>
    </group>
  );
}
