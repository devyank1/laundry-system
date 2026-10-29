import { cachedCanvasTexture } from "./canvasTexture";
import { BasicMat, StdMat } from "./SharedMaterial";

// Speed Queen Stack SSU/SSG (SSU030), desenhada a partir da foto frontal
// (ssg/ssussg.png): gabinete inox, porta da secadora enorme com tambor
// perfurado à vista, duas telas Quantum nas laterais, gaveta de fiapos no
// meio, lavadora com aro branco e alça cromada, rodapé. Medidas nativas em
// metros (ebook SSU/SSG), origem no centro da base, frente voltada para +z.
const W = 0.797;
const H = 2.023;
const D = 1.175;

const FRONT = D / 2;

// Alturas e afastamentos medidos na foto (escala ~2,86 mm/px).
const DRYER_DOOR_Y = 1.6;
const DRYER_DOOR_R = 0.355;
const DRYER_DOOR_X = 0.02;
const CONTROLS_Y = 1.2;
const CONTROLS_X = 0.32;
const LINT_Y = 1.105;
const SEAM_Y = 1.03;
const CARD_Y = 0.97;
const WASHER_DOOR_Y = 0.605;
const WASHER_DOOR_R = 0.3;
const PLINTH_H = 0.19;

function drawDrum(ctx: CanvasRenderingContext2D) {
  // Tambor inox perfurado visto pela porta: fundo cinza com furinhos e as
  // pás mais claras na horizontal.
  const g = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  g.addColorStop(0, "#8a8d91");
  g.addColorStop(1, "#4b4e52");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = "#9ca0a5";
  ctx.fillRect(0, 230, 512, 52);
  ctx.fillStyle = "#2b2d30";
  for (let y = 8; y < 512; y += 14) {
    for (let x = ((y / 14) % 2) * 7 + 8; x < 512; x += 14) {
      if (y > 228 && y < 284) continue;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // parafusos da pá
  ctx.fillStyle = "#1f2124";
  for (const [x, y] of [[230, 210], [282, 210], [230, 300], [282, 300]]) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawScreen(ctx: CanvasRenderingContext2D, ring: string) {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 128, 160);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(76, 82, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText("27", 76, 89);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(14, 50, 22, 6);
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(14, 66, 22, 5);
  ctx.fillRect(14, 80, 22, 5);
}

function drawLogo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Speed Queen", 138, 33);
  ctx.beginPath();
  ctx.arc(22, 24, 11, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function Steel() {
  return <StdMat color="#d4d6d9" roughness={0.32} metalness={0.75} />;
}

function Black() {
  return <StdMat color="#16181b" roughness={0.5} metalness={0.2} />;
}

function Chrome() {
  return <StdMat color="#eef0f2" roughness={0.12} metalness={0.95} />;
}

function Controls({ x, ring, id }: { x: number; ring: string; id: string }) {
  const screen = cachedCanvasTexture(`ssu-screen-${id}`, 128, 160, (ctx) => drawScreen(ctx, ring));
  return (
    <group position={[x, CONTROLS_Y, FRONT]}>
      {/* moldura preta recuada com a tela */}
      <mesh position={[0, 0, 0.004]}>
        <boxGeometry args={[0.13, 0.15, 0.008]} />
        <Black />
      </mesh>
      <mesh position={[0, -0.005, 0.009]}>
        <planeGeometry args={[0.1, 0.12]} />
        <BasicMat map={screen} color={screen ? "#ffffff" : "#f8fafc"} />
      </mesh>
      {/* fechadura acima */}
      <mesh position={[0, 0.1, 0.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.008, 16]} />
        <Chrome />
      </mesh>
    </group>
  );
}

export function SpeedQueenSsu() {
  const drum = cachedCanvasTexture("ssu-dryer-drum", 512, 512, drawDrum);
  const logo = cachedCanvasTexture("ssu-logo", 256, 48, drawLogo);

  return (
    <group>
      {/* Gabinete inox */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <Steel />
      </mesh>

      {/* Frisos: secadora/lavadora e rodapé */}
      {[SEAM_Y, PLINTH_H].map((y) => (
        <mesh key={y} position={[0, y, FRONT + 0.001]}>
          <boxGeometry args={[W + 0.002, 0.005, 0.004]} />
          <BasicMat color="#8f9398" />
        </mesh>
      ))}

      {/* Logo Speed Queen no alto, à esquerda */}
      <mesh position={[-0.27, H - 0.075, FRONT + 0.002]}>
        <planeGeometry args={[0.17, 0.032]} />
        <BasicMat map={logo} color={logo ? "#ffffff" : "#111111"} />
      </mesh>

      {/* Secadora: aro preto grosso, tambor perfurado e dobradiça cromada à direita */}
      <group position={[DRYER_DOOR_X, DRYER_DOOR_Y, FRONT]}>
        <mesh position={[0, 0, 0.012]}>
          <torusGeometry args={[DRYER_DOOR_R - 0.02, 0.022, 16, 64]} />
          <Black />
        </mesh>
        <mesh position={[0, 0, 0.004]}>
          <circleGeometry args={[DRYER_DOOR_R - 0.03, 48]} />
          <BasicMat map={drum} color={drum ? "#ffffff" : "#5b5e62"} />
        </mesh>
        <mesh position={[DRYER_DOOR_R + 0.005, 0, 0.02]}>
          <boxGeometry args={[0.014, DRYER_DOOR_R * 1.5, 0.014]} />
          <Chrome />
        </mesh>
      </group>

      {/* Telas Quantum: secadora à esquerda, lavadora à direita */}
      <Controls x={-CONTROLS_X} ring="#ef4444" id="dry" />
      <Controls x={CONTROLS_X} ring="#38bdf8" id="wash" />

      {/* Gaveta do filtro de fiapos */}
      <mesh position={[0, LINT_Y, FRONT + 0.006]} castShadow>
        <boxGeometry args={[0.47, 0.095, 0.012]} />
        <Steel />
      </mesh>
      <mesh position={[0, LINT_Y + 0.035, FRONT + 0.013]}>
        <boxGeometry args={[0.012, 0.012, 0.004]} />
        <Black />
      </mesh>

      {/* Leitor de cartão da lavadora */}
      <mesh position={[0.16, CARD_Y, FRONT + 0.006]}>
        <boxGeometry args={[0.16, 0.075, 0.012]} />
        <Steel />
      </mesh>
      <mesh position={[0.16, CARD_Y, FRONT + 0.013]}>
        <boxGeometry args={[0.12, 0.028, 0.003]} />
        <Black />
      </mesh>

      {/* Lavadora: aro branco largo com contorno preto, vidro escuro e alça cromada */}
      <group position={[0, WASHER_DOOR_Y, FRONT]}>
        <mesh position={[0, 0, 0.004]}>
          <circleGeometry args={[WASHER_DOOR_R + 0.012, 48]} />
          <Black />
        </mesh>
        <mesh position={[0, 0, 0.012]} castShadow>
          <torusGeometry args={[WASHER_DOOR_R - 0.05, 0.05, 16, 56]} />
          <StdMat color="#f8fafc" roughness={0.35} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.19, 0.02, 40]} />
          <StdMat color="#5f6368" roughness={0.12} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.022]}>
          <circleGeometry args={[0.025, 20]} />
          <StdMat color="#8a8d91" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[-0.2, -0.03, 0.05]} castShadow>
          <boxGeometry args={[0.15, 0.022, 0.02]} />
          <StdMat color="#e5e7eb" roughness={0.25} metalness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
