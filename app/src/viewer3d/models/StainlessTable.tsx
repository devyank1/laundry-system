// Portado de mesa_a_o_inox_3d.html. Medidas nativas em metros, origem no centro da base.
const TABLE_W = 2.0;
const TABLE_D = 0.8;
const TABLE_H = 0.9;
const LEG_R = 0.02;

const LEG_X = TABLE_W / 2 - 0.05;
const LEG_Z = TABLE_D / 2 - 0.05;
const LEGS: [number, number][] = [
  [LEG_X, LEG_Z],
  [-LEG_X, LEG_Z],
  [LEG_X, -LEG_Z],
  [-LEG_X, -LEG_Z],
];

function Inox() {
  return <meshStandardMaterial color="#dddddd" roughness={0.25} metalness={0.9} />;
}

export function StainlessTable() {
  return (
    <group>
      {/* Tampo e prateleira inferior */}
      <mesh position={[0, TABLE_H, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE_W, 0.04, TABLE_D]} />
        <Inox />
      </mesh>
      <mesh position={[0, TABLE_H * 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE_W - 0.05, 0.02, TABLE_D - 0.05]} />
        <Inox />
      </mesh>

      {/* Pernas com pés de borracha */}
      {LEGS.map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, TABLE_H / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[LEG_R, LEG_R, TABLE_H, 16]} />
            <Inox />
          </mesh>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[LEG_R + 0.005, LEG_R + 0.002, 0.04, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.9} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
