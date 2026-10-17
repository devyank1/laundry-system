import { useMemo } from "react";

// Portado de carro pipoca.html. Carrinho vermelho com cabine de vidro, teto
// preto, rodas de raios e pipocas no fundo do vidro. Frente pra +z. Modelo em
// unidades arbitrárias; SCALE leva pra metros (~0,65 m de largura, ~1,3 m de altura).
const SCALE = 0.15;

const RED = "#cc0000";
const BLACK = "#222222";
const METAL = "#cccccc";

function Metal() {
  return <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.2} />;
}

function Wheel({ z }: { z: number }) {
  return (
    <group position={[-1.2, 1.2, z]}>
      <mesh>
        <torusGeometry args={[1.2, 0.15, 16, 32]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (Math.PI / 4) * i]}>
          <cylinderGeometry args={[0.05, 0.05, 2.4]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color={RED} />
      </mesh>
    </group>
  );
}

// Pipocas em posições fixas (pseudo-aleatórias determinísticas) pra não mudar a cada render.
function popcornPositions(): [number, number, number][] {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 250 }, () => [
    (rand() - 0.5) * 3.4,
    4.6 + rand() * 0.4,
    (rand() - 0.5) * 2.4,
  ]);
}

export function PopcornCart() {
  const popcorn = useMemo(popcornPositions, []);

  return (
    <group scale={SCALE}>
      {/* Base vermelha */}
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 3, 3]} />
        <meshStandardMaterial color={RED} roughness={0.3} />
      </mesh>

      {/* Cabine de vidro e pilares dos cantos */}
      <mesh position={[0, 6.25, 0]}>
        <boxGeometry args={[3.8, 3.5, 2.8]} />
        <meshPhysicalMaterial color="#ffffff" transmission={0.7} transparent roughness={0.1} />
      </mesh>
      {([[1.8, 1.3], [-1.8, 1.3], [1.8, -1.3], [-1.8, -1.3]] as const).map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 6.25, z]}>
          <boxGeometry args={[0.2, 3.5, 0.2]} />
          <meshStandardMaterial color={RED} roughness={0.3} />
        </mesh>
      ))}

      {/* Teto preto */}
      <mesh position={[0, 8.4, 0]} castShadow>
        <boxGeometry args={[4.4, 0.8, 3.4]} />
        <meshStandardMaterial color={BLACK} roughness={0.8} />
      </mesh>

      {/* Panela suspensa */}
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.7, 0.6, 0.8, 16]} />
        <Metal />
      </mesh>
      <mesh position={[0, 7.5, 0]}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <Metal />
      </mesh>

      <Wheel z={1.8} />
      <Wheel z={-1.8} />

      {/* Pernas de apoio */}
      {[1.2, -1.2].map((z) => (
        <mesh key={z} position={[1.5, 0.75, z]}>
          <cylinderGeometry args={[0.1, 0.1, 1.5]} />
          <meshStandardMaterial color={RED} roughness={0.3} />
        </mesh>
      ))}

      {/* Alça */}
      <mesh position={[2.2, 3.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2]} />
        <Metal />
      </mesh>
      {[0.8, -0.8].map((z) => (
        <mesh key={z} position={[2, 3.5, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.5]} />
          <Metal />
        </mesh>
      ))}

      {/* Pipocas */}
      {popcorn.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.12, 6, 6]} />
          <meshStandardMaterial color="#ffeebb" roughness={0.9} />
        </mesh>
      ))}

      {/* Luz amarela da máquina */}
      <pointLight position={[0, 5.5, 0]} color="#ffddaa" intensity={0.4} distance={4} />
    </group>
  );
}
