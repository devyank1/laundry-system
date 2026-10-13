import { cachedCanvasTexture } from "./canvasTexture";

// Portado de modelo_3d_m_quina_speed_queen.html. Medidas nativas em metros,
// origem no centro da base, frente voltada para +z.
const W = 0.68;
const H = 1.98;
const D = 0.71;

const FRONT = D / 2;

function drawPanel(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 6;
  ctx.strokeRect(15, 15, 994, 226);

  ctx.fillStyle = "#ff0000";
  ctx.fillRect(490, 40, 44, 4);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Speed Queen", 512, 80);

  ctx.beginPath();
  ctx.arc(512, 130, 25, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#00ff00";
  ctx.font = 'bold 70px "Courier New", monospace';
  ctx.fillText("27", 280, 140);
  ctx.fillText("31", 750, 140);

  const dot = (x: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, 100, 5, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(150, "#ff0000");
  dot(180, "#00ff00");
  dot(620, "#00ff00");
  dot(650, "#00ff00");

  ctx.fillStyle = "#555555";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(150 + i * 60, 170, 45, 25);
    ctx.fillRect(150 + i * 60, 200, 45, 15);
    ctx.fillRect(620 + i * 60, 170, 45, 25);
    ctx.fillRect(620 + i * 60, 200, 45, 15);
  }
}

function WhiteMetal() {
  return <meshStandardMaterial color="#f9fafb" roughness={0.4} metalness={0.1} />;
}

function DarkGlass() {
  return <meshStandardMaterial color="#111111" roughness={0.1} metalness={0.8} />;
}

export function SpeedQueenStack() {
  const panel = cachedCanvasTexture("speed-queen-panel", 1024, 256, drawPanel);

  return (
    <group>
      {/* Chassi */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <WhiteMetal />
      </mesh>

      {/* Separadores lavadora/painel/secadora */}
      {[0.95, 1.15].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[W + 0.002, 0.005, D + 0.002]} />
          <meshBasicMaterial color="#9ca3af" />
        </mesh>
      ))}

      {/* Lavadora: porta redonda */}
      <mesh position={[0, 0.45, FRONT + 0.01]} castShadow>
        <torusGeometry args={[0.22, 0.03, 16, 48]} />
        <WhiteMetal />
      </mesh>
      <mesh position={[0, 0.45, FRONT + 0.015]}>
        <torusGeometry args={[0.2, 0.015, 12, 48]} />
        <meshStandardMaterial color="#cccccc" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.45, FRONT]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.21, 0.18, 0.06, 32]} />
        <DarkGlass />
      </mesh>
      <mesh position={[-0.25, 0.45, FRONT + 0.02]} castShadow>
        <boxGeometry args={[0.04, 0.15, 0.04]} />
        <WhiteMetal />
      </mesh>

      {/* Dispenser de sabão */}
      <mesh position={[0.2, 0.85, FRONT + 0.002]}>
        <boxGeometry args={[0.185, 0.065, 0.005]} />
        <meshBasicMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[0.2, 0.85, FRONT + 0.005]}>
        <boxGeometry args={[0.18, 0.06, 0.01]} />
        <WhiteMetal />
      </mesh>

      {/* Painel de controle */}
      <mesh position={[0, 1.05, FRONT]}>
        <boxGeometry args={[0.68, 0.2, 0.01]} />
        <meshStandardMaterial color="#111111" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, FRONT + 0.006]}>
        <planeGeometry args={[0.66, 0.16]} />
        <meshBasicMaterial map={panel} color={panel ? "#ffffff" : "#111111"} />
      </mesh>

      {/* Secadora: porta retangular */}
      <mesh position={[0, 1.55, FRONT + 0.01]} castShadow>
        <boxGeometry args={[0.48, 0.45, 0.02]} />
        <WhiteMetal />
      </mesh>
      <mesh position={[0, 1.55, FRONT + 0.015]}>
        <boxGeometry args={[0.35, 0.25, 0.025]} />
        <DarkGlass />
      </mesh>
      <mesh position={[-0.2, 1.55, FRONT + 0.03]} castShadow>
        <boxGeometry args={[0.04, 0.15, 0.04]} />
        <WhiteMetal />
      </mesh>
    </group>
  );
}
