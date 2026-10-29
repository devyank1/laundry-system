import { Shape, type Texture } from "three";
import { cachedCanvasTexture } from "./canvasTexture";
import { BasicMat, StdMat } from "./SharedMaterial";

// Lavadora-extratora Speed Queen SYC180 (folheto Lavadoras_SYC180-280):
// gabinete inox, tela Quantum numa moldura trapézio preta no alto, porta
// grande com aro claro, anel preto e alça preta à esquerda, rodapé.
// Medidas nativas em metros (970 × 960 × 1430 mm), origem no centro da base,
// frente voltada para +z.
const W = 0.97;
const H = 1.43;
const D = 0.96;

const FRONT = D / 2;

// Alturas medidas na foto do folheto (~2,26 mm/px).
const SCREEN_Y = 1.31;
const DOOR_Y = 0.775;
const PLINTH_TOP = 0.33;

export function drawQuantumScreen(ctx: CanvasRenderingContext2D, ring: string, value: string) {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 256, 144);
  ctx.fillStyle = ring;
  ctx.fillRect(0, 0, 256, 12);
  ctx.fillStyle = "#9ca3af";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(26, 38 + i * 22, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(38, 35 + i * 22, 60, 6);
  }
  ctx.strokeStyle = ring;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(176, 80, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText(value, 176, 91);
}

export function drawSqBadge(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "italic bold 26px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Speed Queen", 142, 33);
  ctx.beginPath();
  ctx.arc(26, 24, 12, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function Steel() {
  return <StdMat color="#d4d6d9" roughness={0.32} metalness={0.75} />;
}

export function Black() {
  return <StdMat color="#16181b" roughness={0.5} metalness={0.2} />;
}

// Trapézio no plano XY (mais largo em cima), centrado na origem; cacheado
// por medida pra todas as máquinas usarem a mesma geometria.
const bezelShapes = new Map<string, Shape>();

function bezelShape(width: number, height: number): Shape {
  const key = `${width}x${height}`;
  let shape = bezelShapes.get(key);
  if (!shape) {
    const top = width / 2;
    const bottom = width * 0.4;
    shape = new Shape();
    shape.moveTo(-top, height / 2);
    shape.lineTo(top, height / 2);
    shape.lineTo(bottom, -height / 2);
    shape.lineTo(-bottom, -height / 2);
    shape.closePath();
    bezelShapes.set(key, shape);
  }
  return shape;
}

/** Moldura trapézio preta com a tela Quantum; z = 0 na face da frente. */
export function QuantumBezel({ y, width, height, screen }: { y: number; width: number; height: number; screen: Texture | null }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0, 0.002]}>
        <shapeGeometry args={[bezelShape(width, height)]} />
        <Black />
      </mesh>
      <mesh position={[0, 0.004, 0.004]}>
        <planeGeometry args={[width * 0.6, height * 0.72]} />
        <BasicMat map={screen} color={screen ? "#ffffff" : "#f8fafc"} />
      </mesh>
    </group>
  );
}

export function SpeedQueenSyc() {
  const screen = cachedCanvasTexture("syc-screen", 256, 144, (ctx) => drawQuantumScreen(ctx, "#38bdf8", "35"));
  const badge = cachedCanvasTexture("sq-badge", 256, 48, drawSqBadge);

  return (
    <group>
      {/* Gabinete inox */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <Steel />
      </mesh>

      {/* Tampa e rodapé */}
      {[H - 0.035, PLINTH_TOP].map((y) => (
        <mesh key={y} position={[0, y, FRONT + 0.001]}>
          <boxGeometry args={[W + 0.002, 0.005, 0.004]} />
          <BasicMat color="#8f9398" />
        </mesh>
      ))}

      {/* Tela Quantum e logo */}
      <group position={[0, 0, FRONT]}>
        <QuantumBezel y={SCREEN_Y} width={0.27} height={0.135} screen={screen} />
      </group>
      <mesh position={[0.38, H - 0.06, FRONT + 0.002]}>
        <planeGeometry args={[0.15, 0.028]} />
        <BasicMat map={badge} color={badge ? "#ffffff" : "#111111"} />
      </mesh>

      {/* Porta: aro claro largo, anel preto, vidro, cubo do tambor e alça */}
      <group position={[0, DOOR_Y, FRONT]}>
        <mesh position={[0, 0, 0.006]} scale={[1, 1.03, 1]}>
          <circleGeometry args={[0.385, 56]} />
          <StdMat color="#e5e7eb" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <torusGeometry args={[0.27, 0.04, 16, 56]} />
          <Black />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <circleGeometry args={[0.24, 48]} />
          <StdMat color="#4b4f54" roughness={0.12} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <circleGeometry args={[0.045, 24]} />
          <StdMat color="#a3a7ac" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[-0.2, 0.01, 0.06]} castShadow>
          <boxGeometry args={[0.18, 0.03, 0.025]} />
          <Black />
        </mesh>
      </group>
    </group>
  );
}
