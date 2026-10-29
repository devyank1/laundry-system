import { cachedCanvasTexture } from "./canvasTexture";
import { BasicMat, StdMat } from "./SharedMaterial";

// Stack comercial LG (Giant C / Titan): lavadora embaixo, secadora em cima,
// gabinete grafite, portas redondas com aro cromado e os dois painéis de
// comando juntos no meio (fotos da pasta LG). Medidas nativas da Giant C em
// metros; a Titan usa o mesmo desenho esticado pelo FitBox. Origem no centro
// da base, frente voltada para +z.
const W = 0.686;
const H = 1.954;
const D = 0.764;

const FRONT = D / 2;

// Alturas (do piso) tiradas das proporções da foto da Giant C.
const WASHER_DOOR_Y = 0.55;
const DRYER_DOOR_Y = 1.47;
const PANEL_LOW_Y = 0.905; // painel da lavadora
const PANEL_HIGH_Y = 1.045; // painel da secadora
const PANEL_H = 0.13;

function drawPanel(ctx: CanvasRenderingContext2D) {
  // Faixa grafite com logo à esquerda, visor cinza-claro e caixa de ficha à direita.
  ctx.fillStyle = "#4b4f54";
  ctx.fillRect(0, 0, 1024, 192);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "bold 34px Arial";
  ctx.textAlign = "left";
  ctx.fillText("LG", 70, 62);
  ctx.beginPath();
  ctx.arc(45, 50, 16, 0, Math.PI * 2);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = "18px Arial";
  ctx.fillText("Commercial Laundry", 140, 60);

  // Visor
  ctx.fillStyle = "#c9d3d6";
  ctx.fillRect(470, 30, 300, 130);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(560, 60, 110, 40);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.fillText("88:88", 615, 90);
  ctx.fillStyle = "#6b7280";
  for (let i = 0; i < 5; i++) ctx.fillRect(700, 40 + i * 22, 50, 14);

  // Caixa de ficha/cartão
  ctx.fillStyle = "#6b7075";
  ctx.fillRect(830, 30, 150, 130);
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(860, 95, 90, 8);
}

function Graphite() {
  return <StdMat color="#6b7075" roughness={0.45} metalness={0.5} />;
}

function Chrome() {
  return <StdMat color="#e5e7eb" roughness={0.15} metalness={0.95} />;
}

function DoorGlass() {
  return <StdMat color="#4a565c" roughness={0.05} metalness={0.6} />;
}

function RoundDoor({ y, teal }: { y: number; teal?: boolean }) {
  return (
    <group position={[0, y, FRONT]}>
      <mesh position={[0, 0, 0.018]} castShadow>
        <torusGeometry args={[0.215, 0.032, 16, 48]} />
        <Chrome />
      </mesh>
      {teal && (
        <mesh position={[0, 0, 0.022]}>
          <torusGeometry args={[0.18, 0.012, 12, 48]} />
          <StdMat color="#0f766e" roughness={0.3} metalness={0.4} />
        </mesh>
      )}
      {/* Tambor inox atrás do vidro */}
      <mesh position={[0, 0, -0.004]}>
        <circleGeometry args={[0.18, 32]} />
        <StdMat color="#9ca3af" roughness={0.35} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.19, 0.17, 0.03, 32]} />
        <DoorGlass />
      </mesh>
    </group>
  );
}

export function LgStack() {
  const panel = cachedCanvasTexture("lg-stack-panel", 1024, 192, drawPanel);

  return (
    <group>
      {/* Gabinete */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <Graphite />
      </mesh>

      {/* Tampa de cima e frisos entre os módulos */}
      {[H - 0.09, PANEL_HIGH_Y + PANEL_H / 2 + 0.005, PANEL_LOW_Y - PANEL_H / 2 - 0.005].map((y) => (
        <mesh key={y} position={[0, y, FRONT + 0.001]}>
          <boxGeometry args={[W + 0.002, 0.006, 0.004]} />
          <BasicMat color="#3f4347" />
        </mesh>
      ))}

      {/* Portas */}
      <RoundDoor y={WASHER_DOOR_Y} teal />
      <RoundDoor y={DRYER_DOOR_Y} teal />

      {/* Painéis de comando (lavadora e secadora) */}
      {[PANEL_LOW_Y, PANEL_HIGH_Y].map((y) => (
        <group key={y}>
          <mesh position={[0, y, FRONT + 0.008]}>
            <boxGeometry args={[W - 0.01, PANEL_H, 0.016]} />
            <StdMat color="#4b4f54" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, y, FRONT + 0.017]}>
            <planeGeometry args={[W - 0.03, PANEL_H - 0.02]} />
            <BasicMat map={panel} color={panel ? "#ffffff" : "#4b4f54"} />
          </mesh>
        </group>
      ))}

      {/* Dispenser de sabão (lado esquerdo do painel da lavadora) */}
      <mesh position={[-0.24, PANEL_LOW_Y - 0.02, FRONT + 0.02]}>
        <boxGeometry args={[0.13, 0.035, 0.012]} />
        <StdMat color="#3f4347" roughness={0.5} />
      </mesh>

      {/* Painel de serviço frontal (bomba na frente) */}
      <mesh position={[-0.2, 0.1, FRONT + 0.003]}>
        <boxGeometry args={[0.14, 0.11, 0.008]} />
        <StdMat color="#52565b" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
}
