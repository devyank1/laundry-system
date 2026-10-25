import { cachedCanvasTexture } from "./canvasTexture";
import { BasicMat, StdMat } from "./SharedMaterial";

// Totem de pagamento de parede, baseado em totem_3d_lavanderia.html (tela PagLave +
// módulo verde com impressora e NFC), sem pés nem inclinação: fica embutido no drywall.
// Medidas reais em metros, origem no centro da base, tela voltada para +z.
const BODY_W = 0.4;
const BODY_H = 0.42;
const BODY_D = 0.12;
const TOP_H = 0.13;
const LIME = "#84cc16";

function drawScreen(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 600, 1000);
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "bold 60px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PagLave", 300, 120);

  const button = (y: number, color: string, text: string) => {
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.beginPath();
    ctx.roundRect(50, y + 5, 500, 120, 20);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(50, y, 500, 120, 20);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(text, 300, y + 75);
  };
  button(200, "#2563eb", "LAVAR");
  button(350, "#f59e0b", "SECAR");
  button(500, "#10b981", "PACOTES");
  button(650, "#6d28d9", "FIDELIDADE");

  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 880, 600, 120);
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("PagLave", 300, 950);
}

function drawNfc(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = LIME;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(100, 128, 30 * i, -Math.PI / 4, Math.PI / 4);
    ctx.stroke();
  }
  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  ctx.roundRect(160, 98, 60, 40, 5);
  ctx.fill();
}

function DarkMetal() {
  return <StdMat color="#111111" roughness={0.7} metalness={0.6} />;
}

export function PaymentTotem() {
  const screen = cachedCanvasTexture("totem-screen", 600, 1000, drawScreen);
  const nfc = cachedCanvasTexture("totem-nfc", 256, 256, drawNfc);
  const front = BODY_D / 2;

  return (
    <group>
      {/* Corpo com a tela */}
      <mesh position={[0, BODY_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BODY_W, BODY_H, BODY_D]} />
        <DarkMetal />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (BODY_W / 2 - 0.008), BODY_H / 2, 0.01]}>
          <boxGeometry args={[0.016, BODY_H, BODY_D + 0.02]} />
          <DarkMetal />
        </mesh>
      ))}
      <mesh position={[0, BODY_H / 2, front + 0.002]}>
        <planeGeometry args={[0.24, 0.38]} />
        <BasicMat map={screen} color={screen ? "#ffffff" : "#e5e7eb"} />
      </mesh>

      {/* Módulo verde superior: impressora e NFC na frente */}
      <group position={[0, BODY_H + TOP_H / 2, 0.01]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[BODY_W, TOP_H, BODY_D + 0.02]} />
          <StdMat color={LIME} roughness={0.3} metalness={0.1} />
        </mesh>
        <mesh position={[-0.08, -0.03, front + 0.011]}>
          <boxGeometry args={[0.16, 0.012, 0.004]} />
          <BasicMat color="#000000" />
        </mesh>
        <mesh position={[0.11, 0, front + 0.012]}>
          <planeGeometry args={[0.1, 0.1]} />
          <StdMat map={nfc} color={LIME} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
