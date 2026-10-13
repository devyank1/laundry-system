import { cachedCanvasTexture } from "./canvasTexture";

// Portado de torre_lavadora_e_secadora_3d.html. Medidas nativas em metros,
// origem no centro da base, frente voltada para +z.
const W = 0.7;
const H = 2.0;
const D = 0.75;

const FRONT = D / 2;

const FINISH = {
  white: { color: "#f3f4f6", roughness: 0.4, metalness: 0.1 },
  silver: { color: "#cccccc", roughness: 0.3, metalness: 0.8 },
};

function drawPanel(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, 1024, 256);

  ctx.fillStyle = "#1e3a8a";
  ctx.beginPath();
  ctx.arc(80, 128, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial";
  ctx.fillText("BRAND", 45, 135);

  // Fechadura central
  ctx.fillStyle = "#cccccc";
  ctx.beginPath();
  ctx.arc(512, 100, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(512, 100);
  ctx.lineTo(505, 130);
  ctx.lineTo(519, 130);
  ctx.fill();

  const drawDisplay = (x: number, y: number, color: string, label: string) => {
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, 160, 80);
    ctx.fillStyle = "#111111";
    ctx.fillRect(x, y, 160, 80);
    ctx.fillStyle = color;
    ctx.font = "bold 36px monospace";
    ctx.fillText(label, x + 35, y + 55);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillRect(x + 110 + j * 15, y + 15 + i * 20, 10, 10);
      }
    }
  };
  drawDisplay(300, 140, "#ef4444", "30.0");
  drawDisplay(564, 140, "#3b82f6", "45.0");
}

function BlackPlastic() {
  return <meshStandardMaterial color="#111111" roughness={0.6} metalness={0.2} />;
}

function DarkGlass() {
  return (
    <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.9} transparent opacity={0.85} />
  );
}

const SLITS = Array.from({ length: 21 }, (_, i) => (i - 10) * 0.025);

export function TowerMachine({ finish }: { finish: "white" | "silver" }) {
  const panel = cachedCanvasTexture("tower-panel", 1024, 256, drawPanel);
  const body = FINISH[finish];

  return (
    <group>
      {/* Chassi */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial {...body} />
      </mesh>

      {/* Fendas de ventilação no topo */}
      {SLITS.map((x) => (
        <mesh key={x} position={[x, 1.95, FRONT + 0.001]}>
          <boxGeometry args={[0.015, 0.06, 0.01]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      ))}

      {/* Secadora (porta superior) */}
      <group position={[0, 1.5, FRONT + 0.01]}>
        <mesh castShadow>
          <torusGeometry args={[0.24, 0.035, 16, 48]} />
          <BlackPlastic />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.23, 0.21, 0.05, 32]} />
          <DarkGlass />
        </mesh>
        <mesh position={[0.27, 0, 0]}>
          <boxGeometry args={[0.04, 0.3, 0.04]} />
          <BlackPlastic />
        </mesh>
      </group>

      {/* Lavadora (porta inferior) */}
      <group position={[0, 0.5, FRONT + 0.01]}>
        <mesh castShadow>
          <torusGeometry args={[0.2, 0.04, 16, 48]} />
          <BlackPlastic />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.19, 0.16, 0.06, 32]} />
          <DarkGlass />
        </mesh>
        <mesh position={[0.23, 0, 0]}>
          <boxGeometry args={[0.05, 0.15, 0.05]} />
          <BlackPlastic />
        </mesh>
        <mesh position={[-0.23, 0, 0.02]}>
          <boxGeometry args={[0.04, 0.1, 0.06]} />
          <BlackPlastic />
        </mesh>
      </group>

      {/* Painel central */}
      <mesh position={[0, 1.05, FRONT + 0.005]}>
        <planeGeometry args={[0.7, 0.175]} />
        <meshBasicMaterial map={panel} color={panel ? "#ffffff" : "#0a0a0a"} />
      </mesh>
    </group>
  );
}
