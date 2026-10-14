import { useMemo } from "react";
import { CanvasTexture, ClampToEdgeWrapping, DoubleSide, RepeatWrapping } from "three";

// Portado de mesa_inox_com_cestos.html. Medidas nativas em metros, origem no
// centro da base. Mesa de aço inox (igual mesa_a_o_inox_3d.html) + 3 cestos
// plásticos perfurados na prateleira inferior, para dobra/triagem de roupa.
const TABLE_W = 2.0;
const TABLE_D = 0.8;
const TABLE_H = 0.9;
const LEG_R = 0.02;
const SHELF_Y = TABLE_H * 0.3;

const LEG_X = TABLE_W / 2 - 0.05;
const LEG_Z = TABLE_D / 2 - 0.05;
const LEGS: [number, number][] = [
  [LEG_X, LEG_Z],
  [-LEG_X, LEG_Z],
  [LEG_X, -LEG_Z],
  [-LEG_X, -LEG_Z],
];

const BASKET_HEIGHT = 0.45;
const BASKET_RADIUS_TOP = 0.22;
const BASKET_RADIUS_BOTTOM = 0.16;
const BASKET_X_POSITIONS = [-0.6, 0, 0.6];

function Inox() {
  return <meshStandardMaterial color="#dddddd" roughness={0.25} metalness={0.9} />;
}

function useBasketAlphaMap(): CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#000000";

    // Corte ondulado do topo (alças)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= 1024; x += 5) {
      const angle = (x / 1024) * Math.PI * 4;
      const y = 60 + Math.cos(angle) * 45;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(1024, 0);
    ctx.closePath();
    ctx.fill();

    // Grade de furos
    const radius = 14;
    const spacing = 45;
    for (let y = 130; y < 480; y += spacing) {
      const isEvenRow = Math.floor(y / spacing) % 2 === 0;
      const offsetX = isEvenRow ? 0 : spacing / 2;
      for (let x = 0; x <= 1024; x += spacing) {
        ctx.beginPath();
        ctx.arc(x + offsetX, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    return texture;
  }, []);
}

function Basket({ x, alphaMap }: { x: number; alphaMap: CanvasTexture }) {
  const y = SHELF_Y + BASKET_HEIGHT / 2 + 0.01;
  return (
    <group position={[x, y, 0]} rotation={[0, Math.PI / 4, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[BASKET_RADIUS_TOP, BASKET_RADIUS_BOTTOM, BASKET_HEIGHT, 32, 1, true]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.9}
          metalness={0.05}
          alphaMap={alphaMap}
          alphaTest={0.5}
          transparent
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, -BASKET_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[BASKET_RADIUS_BOTTOM, BASKET_RADIUS_BOTTOM, 0.01, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  );
}

export function StainlessTable() {
  const basketAlphaMap = useBasketAlphaMap();

  return (
    <group>
      {/* Tampo e prateleira inferior */}
      <mesh position={[0, TABLE_H, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE_W, 0.04, TABLE_D]} />
        <Inox />
      </mesh>
      <mesh position={[0, SHELF_Y, 0]} castShadow receiveShadow>
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

      {/* Cestos de triagem/dobra na prateleira inferior */}
      {BASKET_X_POSITIONS.map((x) => (
        <Basket key={x} x={x} alphaMap={basketAlphaMap} />
      ))}
    </group>
  );
}
