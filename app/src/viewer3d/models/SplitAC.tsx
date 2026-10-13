import { useMemo } from "react";
import { AdditiveBlending, ExtrudeGeometry, Shape } from "three";
import { cachedCanvasTexture } from "./canvasTexture";

// Portado de ar_condicionado_3d.html. Medidas nativas em metros, centrado na origem,
// fundo encostado na parede (-z), frente voltada para +z.

function buildBodyGeometry(): ExtrudeGeometry {
  // Perfil lateral (x = profundidade, y = altura), extrudado na largura.
  const profile = new Shape();
  profile.moveTo(0, 0);
  profile.lineTo(0, 1.0);
  profile.lineTo(0.5, 1.0);
  profile.quadraticCurveTo(0.65, 1.0, 0.65, 0.85);
  profile.lineTo(0.72, 0.25);
  profile.quadraticCurveTo(0.73, 0.1, 0.6, 0.1);
  profile.lineTo(0.5, 0.1);
  profile.lineTo(0.5, 0.25);
  profile.lineTo(0.15, 0.25);
  profile.lineTo(0.15, 0);
  profile.lineTo(0, 0);

  const geometry = new ExtrudeGeometry(profile, {
    depth: 4.0,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelThickness: 0.02,
    bevelSize: 0.02,
  });
  geometry.center();
  return geometry;
}

function drawLed(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#e0ffff";
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 15;
  ctx.font = 'bold 80px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("24", 110, 95);
  ctx.font = 'bold 30px "Inter", sans-serif';
  ctx.fillText("°", 170, 45);
}

function drawLogo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#888888";
  ctx.font = 'bold 24px "Inter", sans-serif';
  ctx.fillText("COOLAIR", 10, 40);
}

function GlossyWhite() {
  return <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} />;
}

function DarkMatte() {
  return <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.2} />;
}

const DIVIDERS = Array.from({ length: 11 }, (_, i) => (i - 5) * 0.35);

export function SplitAC() {
  const body = useMemo(() => buildBodyGeometry(), []);
  const led = cachedCanvasTexture("ac-led", 256, 128, drawLed);
  const logo = cachedCanvasTexture("ac-logo", 256, 64, drawLogo);

  return (
    <group>
      <mesh geometry={body} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
        <GlossyWhite />
      </mesh>

      {/* Saída de ar escura, aleta e divisórias */}
      <mesh position={[0, -0.38, 0.05]}>
        <boxGeometry args={[3.9, 0.18, 0.35]} />
        <DarkMatte />
      </mesh>
      <mesh position={[0, -0.42, 0.15]} rotation={[Math.PI / 6, 0, 0]}>
        <boxGeometry args={[3.8, 0.015, 0.15]} />
        <GlossyWhite />
      </mesh>
      {DIVIDERS.map((x) => (
        <mesh key={x} position={[x, -0.38, 0.12]} rotation={[0, -Math.PI / 12, 0]}>
          <boxGeometry args={[0.01, 0.08, 0.12]} />
          <DarkMatte />
        </mesh>
      ))}

      {/* Display de temperatura */}
      {led && (
        <mesh position={[0, 0, 0.32]} rotation={[-0.15, 0, 0]}>
          <planeGeometry args={[0.5, 0.25]} />
          <meshStandardMaterial
            map={led}
            emissiveMap={led}
            emissive="#ffffff"
            emissiveIntensity={1.5}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Logo */}
      {logo && (
        <mesh position={[-1.6, 0.35, 0.24]} rotation={[-0.05, 0, 0]}>
          <planeGeometry args={[0.6, 0.15]} />
          <meshBasicMaterial map={logo} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
