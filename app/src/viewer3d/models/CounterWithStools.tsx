import { StdMat } from "./SharedMaterial";
// Portado de "Cadeira com mesa Trab.html". Balcão alto de madeira clara com 3
// banquetas industriais de metal. Origem no ponto de contato com a parede, no
// meio do comprimento: costas do balcão em z = 0, banquetas na frente (+z).
// Modelo em unidades arbitrárias; SCALE leva pra metros (2,0 m de comprimento,
// 1,0 m de altura).
const SCALE = 0.25;

const TABLE_W = 8;
const TABLE_H = 4;
const TABLE_D = 1.5;
const TOP_THICKNESS = 0.2;
const SEAT_W = 1.5;
const SEAT_Y = 2.7;
const SEAT_THICKNESS = 0.12;
const INSET = SEAT_W / 2 - 0.12;
const BACK_H = 1.3;
const STOOL_Z = 1.5;
const STOOL_X = [-2.4, 0, 2.4];

function Wood() {
  return <StdMat color="#dec29b" roughness={0.55} metalness={0.05} />;
}

function Metal() {
  return <StdMat color="#1a1a1a" roughness={0.35} metalness={0.2} />;
}

// Virada pro balcão: o encosto fica do lado de fora (+z), longe da mesa.
function Stool({ x }: { x: number }) {
  return (
    <group position={[x, 0, STOOL_Z]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, SEAT_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[SEAT_W, SEAT_THICKNESS, SEAT_W]} />
        <StdMat color="#222222" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Pernas */}
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * INSET, SEAT_Y / 2, sz * INSET]} castShadow>
          <cylinderGeometry args={[0.04, 0.032, SEAT_Y, 12]} />
          <Metal />
        </mesh>
      ))}

      {/* Apoio de pés */}
      <mesh position={[0, 0.8, INSET]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, SEAT_W - 0.2, 8]} />
        <Metal />
      </mesh>
      <mesh position={[0, 0.9, -INSET]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, SEAT_W - 0.2, 8]} />
        <Metal />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * INSET, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, SEAT_W - 0.2, 8]} />
          <Metal />
        </mesh>
      ))}

      {/* Encosto */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * INSET, SEAT_Y + BACK_H / 2, -INSET]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, BACK_H, 12]} />
          <Metal />
        </mesh>
      ))}
      <mesh position={[0, SEAT_Y + BACK_H - 0.25, -INSET]} castShadow receiveShadow>
        <boxGeometry args={[SEAT_W - 0.1, 0.45, 0.08]} />
        <Metal />
      </mesh>
      <mesh position={[0, SEAT_Y + BACK_H - 0.75, -INSET]} castShadow>
        <boxGeometry args={[SEAT_W - 0.3, 0.12, 0.05]} />
        <Metal />
      </mesh>
    </group>
  );
}

export function CounterWithStools() {
  const sideH = TABLE_H - TOP_THICKNESS;

  return (
    // Sobe a mesa meia profundidade: costas do balcão encostam em z = 0.
    <group scale={SCALE}>
      <group position={[0, 0, TABLE_D / 2]}>
        <mesh position={[0, TABLE_H - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[TABLE_W, TOP_THICKNESS, TABLE_D]} />
          <Wood />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (TABLE_W / 2 - 0.1), sideH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.2, sideH, TABLE_D - 0.04]} />
            <Wood />
          </mesh>
        ))}
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[TABLE_W - 0.4, 0.15, 0.15]} />
          <Wood />
        </mesh>
        {STOOL_X.map((x) => (
          <Stool key={x} x={x} />
        ))}
      </group>
    </group>
  );
}
