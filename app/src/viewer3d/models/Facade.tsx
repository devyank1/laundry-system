import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, RepeatWrapping, type Group } from "three";
import type { Layout } from "../../engine/types";
import { doorShouldOpen, facadeDims, facadeLogoPlacement, type FacadeDims } from "../facade";
import { cachedCanvasTexture } from "./canvasTexture";
import { PlacedLogo, type SceneLogo } from "./WallLogo";
import { StdMat } from "./SharedMaterial";

const FRAME_COLOR = "#1f2937"; // perfis de alumínio preto
const FRAME_WIDTH = 0.04;
const MARQUEE_DOWN = "#f1f5f9";
const SIDEWALK_DEPTH = 2.5; // calçada na frente da loja
const SIDEWALK_MARGIN = 1; // além das bordas da fachada
const DOOR_OPEN_ANGLE = Math.PI * 0.47; // ~85°, pra dentro da loja
const DOOR_SPEED = 2.2; // rad/s abrindo e fechando
const DOOR_LEAF_GAP = 0.01;

const glassMaterial = (
  <StdMat
    color="#bfdbfe"
    transparent
    opacity={0.18}
    roughness={0.05}
    metalness={0.1}
    depthWrite={false}
    side={DoubleSide}
  />
);
const profileMaterial = <StdMat color={FRAME_COLOR} metalness={0.6} roughness={0.4} />;

function GlassPane({ x0, x1, y0, y1, z }: { x0: number; x1: number; y0: number; y1: number; z: number }) {
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, z]}>
      <planeGeometry args={[x1 - x0 - FRAME_WIDTH, y1 - y0 - FRAME_WIDTH]} />
      {glassMaterial}
    </mesh>
  );
}

// Porta de vidro da frente, dobradiça no perfil esquerdo, abrindo pra dentro.
// Sensor de presença: abre sozinha quando alguém (a câmera na altura do olho,
// como na "visão do cliente") chega perto, e fecha quando a pessoa se afasta.
function FrontDoor({ dims }: { dims: FacadeDims }) {
  const leaf = useRef<Group>(null);
  const angle = useRef(0);
  const { door, glassZ } = dims;
  const w = door.x1 - door.x0 - DOOR_LEAF_GAP * 2;
  const h = door.height - DOOR_LEAF_GAP;

  useFrame(({ camera, invalidate, gl }, delta) => {
    const target = doorShouldOpen(dims, [camera.position.x, camera.position.y, camera.position.z])
      ? DOOR_OPEN_ANGLE
      : 0;
    const step = DOOR_SPEED * Math.min(delta, 0.1);
    const a = angle.current;
    angle.current = a < target ? Math.min(target, a + step) : Math.max(target, a - step);
    // y positivo leva a ponta da folha pra -z (dentro da loja)
    if (leaf.current) leaf.current.rotation.y = angle.current;
    // frameloop="demand": a porta ainda está abrindo/fechando, pede mais um quadro.
    if (angle.current !== target) {
      gl.shadowMap.needsUpdate = true; // sombras estáticas: porta mexendo refaz
      invalidate();
    }
  });

  return (
    <group ref={leaf} position={[door.x0 + DOOR_LEAF_GAP, 0, glassZ]}>
      <mesh position={[w / 2, h / 2, 0]}>
        <planeGeometry args={[w, h]} />
        {glassMaterial}
      </mesh>
      {/* Quadro de alumínio da folha */}
      {[
        [w / 2, FRAME_WIDTH, w, FRAME_WIDTH * 2],
        [w / 2, h - FRAME_WIDTH / 2, w, FRAME_WIDTH],
        [FRAME_WIDTH / 2, h / 2, FRAME_WIDTH, h],
        [w - FRAME_WIDTH / 2, h / 2, FRAME_WIDTH, h],
      ].map(([x, y, sx, sy]) => (
        <mesh key={`${x}-${y}`} position={[x, y, 0]} castShadow>
          <boxGeometry args={[sx, sy, 0.045]} />
          {profileMaterial}
        </mesh>
      ))}
      {/* Puxador vertical dos dois lados */}
      <mesh position={[w - 0.12, 1.05, 0]}>
        <boxGeometry args={[0.025, 0.8, 0.14]} />
        <StdMat color="#d1d5db" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

// Textura "granilite" (pontilhado claro/escuro sobre a cor do painel).
function graniteTexture(hex: string) {
  const texture = cachedCanvasTexture(`facade-granite-${hex}`, 512, 512, (ctx) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 512, 512);
    // pseudoaleatório determinístico: mesma cor → mesma textura
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 9000; i++) {
      const light = rand() > 0.5;
      ctx.fillStyle = light ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.28)";
      const r = 0.6 + rand() * 1.4;
      ctx.beginPath();
      ctx.arc(rand() * 512, rand() * 512, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  if (texture) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(3, 1);
  }
  return texture;
}

function Block({
  x0,
  x1,
  y0,
  y1,
  z0,
  z1,
  children,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  children: ReactNode;
}) {
  if (x1 <= x0 || y1 <= y0) return null;
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} castShadow receiveShadow>
      <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
      {children}
    </mesh>
  );
}

// Fachada da loja na parede da frente: moldura saltada (pilares + faixa de
// cima) e, recuado nela, o painel do letreiro com a vitrine embaixo; a
// marquise sai do pé do painel com os spots acesos. Logo enviada no painel.
export function Facade({
  layout,
  wallColor,
  signColor,
  logo,
  spotIntensity,
}: {
  layout: Layout;
  wallColor: string;
  signColor: string;
  logo?: SceneLogo | null;
  // Luz de cada spot da marquise (ilumina a fachada e a calçada).
  spotIntensity: number;
}) {
  const d = facadeDims(layout);
  const { opening, marquee, sign, wallZ, frontZ, nicheZ, glassZ } = d;
  const granite = graniteTexture(signColor);
  const graniteMaterial = (
    <StdMat color={granite ? "#ffffff" : signColor} map={granite} roughness={0.95} />
  );
  const frame = <StdMat color={wallColor} roughness={0.85} />;
  // Perfis verticais: bordas de cada vidro fixo e os dois lados da porta.
  const mullionXs = [
    ...new Set([...d.glassPanes.flatMap((p) => [p.x0, p.x1]), d.door.x0, d.door.x1]),
  ];
  const spotZ = (marquee.z0 + marquee.z1) / 2;

  return (
    <group>
      {/* Moldura saltada: pilares dos lados e faixa acima do painel */}
      <Block x0={d.outerX0} x1={opening.x0} y0={0} y1={d.height} z0={wallZ} z1={frontZ}>
        {frame}
      </Block>
      <Block x0={opening.x1} x1={d.outerX1} y0={0} y1={d.height} z0={wallZ} z1={frontZ}>
        {frame}
      </Block>
      <Block x0={opening.x0} x1={opening.x1} y0={sign.y1} y1={d.height} z0={wallZ} z1={frontZ}>
        {frame}
      </Block>

      {/* Painel do letreiro, recuado dentro da moldura e descendo até a marquise */}
      <Block x0={sign.x0} x1={sign.x1} y0={sign.y0} y1={sign.y1} z0={wallZ} z1={nicheZ}>
        {graniteMaterial}
      </Block>
      {logo && (
        <PlacedLogo
          logo={logo}
          place={(aspect, standoff) => facadeLogoPlacement(d, aspect, standoff)}
        />
      )}

      {/* Vitrine: vidros fixos com perfis pretos, no fundo do nicho, e a porta */}
      {d.glassPanes.map((p) => (
        <GlassPane key={`glass-${p.x0}`} x0={p.x0} x1={p.x1} y0={0} y1={opening.height} z={glassZ} />
      ))}
      {opening.height - d.door.height > FRAME_WIDTH && (
        <GlassPane x0={d.door.x0} x1={d.door.x1} y0={d.door.height} y1={opening.height} z={glassZ} />
      )}
      {mullionXs.map((fx) => (
        <Block
          key={`mullion-${fx}`}
          x0={fx - FRAME_WIDTH / 2}
          x1={fx + FRAME_WIDTH / 2}
          y0={0}
          y1={opening.height}
          z0={glassZ - 0.03}
          z1={glassZ + 0.03}
        >
          {profileMaterial}
        </Block>
      ))}
      {/* Rodapé dos vidros fixos (a porta não tem soleira alta) e travessa em cima da porta */}
      {d.glassPanes.map((p) => (
        <Block
          key={`sill-${p.x0}`}
          x0={p.x0}
          x1={p.x1}
          y0={0}
          y1={FRAME_WIDTH}
          z0={glassZ - 0.03}
          z1={glassZ + 0.03}
        >
          {profileMaterial}
        </Block>
      ))}
      <Block
        x0={d.door.x0}
        x1={d.door.x1}
        y0={d.door.height}
        y1={d.door.height + FRAME_WIDTH}
        z0={glassZ - 0.03}
        z1={glassZ + 0.03}
      >
        {profileMaterial}
      </Block>
      <FrontDoor dims={d} />

      {/* Marquise: sai do pé do painel, passa da moldura, spots por baixo */}
      <Block
        x0={marquee.x0}
        x1={marquee.x1}
        y0={marquee.y}
        y1={marquee.y + marquee.thickness}
        z0={marquee.z0}
        z1={marquee.z1}
      >
        {graniteMaterial}
      </Block>
      {d.downlightsX.map((x) => (
        <group key={`spot-${x}`}>
          <mesh position={[x, marquee.y - 0.004, spotZ]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.28, 0.08]} />
            <StdMat
              color={MARQUEE_DOWN}
              emissive="#fff7e0"
              emissiveIntensity={2}
              toneMapped={false}
              side={DoubleSide}
            />
          </mesh>
          <pointLight
            position={[x, marquee.y - 0.15, spotZ]}
            color="#ffe9c4"
            intensity={spotIntensity}
            distance={3.5}
            decay={2}
          />
        </group>
      ))}

      {/* Calçada */}
      <mesh
        position={[(d.outerX0 + d.outerX1) / 2, -0.01, frontZ + SIDEWALK_DEPTH / 2]}
        receiveShadow
      >
        <boxGeometry
          args={[d.outerX1 - d.outerX0 + SIDEWALK_MARGIN * 2, 0.02, SIDEWALK_DEPTH]}
        />
        <StdMat color="#d6d3d1" roughness={0.95} />
      </mesh>
    </group>
  );
}
