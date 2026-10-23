// Portado de html-3d/Molden internet.html: roteador/modem preto de parede —
// corpo com painel frontal chanfrado, suporte traseiro, etiqueta branca,
// faixa da marca, 5 LEDs (4 verdes acesos) e 4 antenas articuladas.
// Unidades do modelo; MODEM_SCALE leva pra metros (~0,25 x 0,175 m, antenas
// ~0,26 m). Frente pra +z; as costas do suporte encostam em z = 0.
export const MODEM_SCALE = 0.0625;
export const MODEM_SIZE_M = {
  width: 4.0 * MODEM_SCALE,
  height: 2.8 * MODEM_SCALE,
  depth: 0.6 * MODEM_SCALE,
  antennaTop: 4.9 * MODEM_SCALE, // ponta das antenas acima do centro
};

const BODY = { color: "#1a1a1a", roughness: 0.4, metalness: 0.15 } as const;
const BEVEL = { color: "#111111", roughness: 0.3, metalness: 0.2 } as const;
const ANTENNA = { color: "#151515", roughness: 0.35, metalness: 0.3 } as const;

const ANTENNAS = [
  { x: -2.05, y: -0.2, rotZ: 0.12 },
  { x: -2.05, y: 0.7, rotZ: 0.04 },
  { x: 2.05, y: 0.7, rotZ: -0.04 },
  { x: 2.05, y: -0.2, rotZ: -0.12 },
];

export function Modem() {
  return (
    <group scale={MODEM_SCALE} position={[0, 0, 0.3 * MODEM_SCALE]}>
      <mesh castShadow>
        <boxGeometry args={[4.0, 2.8, 0.45]} />
        <meshStandardMaterial {...BODY} />
      </mesh>
      <mesh position={[0, 0, 0.23]}>
        <boxGeometry args={[3.88, 2.68, 0.06]} />
        <meshStandardMaterial {...BEVEL} />
      </mesh>
      <mesh position={[0, 0, -0.26]}>
        <boxGeometry args={[2.4, 1.8, 0.08]} />
        <meshStandardMaterial {...BEVEL} />
      </mesh>
      <mesh position={[-1.3, 0.9, 0.262]}>
        <planeGeometry args={[0.7, 0.35]} />
        <meshStandardMaterial color="#f8f9fa" roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.05, 0.262]}>
        <planeGeometry args={[0.9, 0.08]} />
        <meshStandardMaterial color="#cccccc" roughness={0.3} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[-0.8 + i * 0.4, -1.15, 0.262]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.02, 12]} />
          {i < 4 ? (
            <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={0.9} roughness={0.2} />
          ) : (
            <meshStandardMaterial color="#224422" emissive="#001100" emissiveIntensity={0.1} roughness={0.5} />
          )}
        </mesh>
      ))}
      {ANTENNAS.map((a) => (
        <group key={`${a.x}${a.y}`} position={[a.x, a.y, 0]} rotation={[0, 0, a.rotZ]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.09, 0.25, 16]} />
            <meshStandardMaterial {...BEVEL} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.12, 0.35, 0.12]} />
            <meshStandardMaterial {...ANTENNA} />
          </mesh>
          <mesh position={[0, 2.1, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.08, 3.8, 16]} />
            <meshStandardMaterial {...ANTENNA} />
          </mesh>
          <mesh position={[0, 4.1, 0]}>
            <coneGeometry args={[0.05, 0.2, 16]} />
            <meshStandardMaterial {...ANTENNA} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
