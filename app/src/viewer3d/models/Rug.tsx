import { useLayoutEffect, useMemo, useRef } from "react";
import { CanvasTexture, ExtrudeGeometry, InstancedMesh, Object3D, RepeatWrapping, Shape } from "three";
import { PlacedLogo, type SceneLogo } from "./WallLogo";

// Inspirado em tapete.html: tapete retangular azul-claro de cantos
// arredondados, textura têxtil suave e franjas nas duas pontas. Aqui tem
// tamanho de verdade (largura x profundidade em metros) e leva a logo da loja
// no centro, deitada. Origem no centro, no chão; largura em x, profundidade
// em z; o topo da logo aponta pra -z (pra parede das máquinas / pro fundo da loja).
const THICKNESS = 0.02;
const CORNER_RADIUS = 0.05;
const BEVEL = 0.004;
const FRINGE_LENGTH = 0.05;
const FRINGE_SPACING = 0.02;
const LOGO_MAX_WIDTH = 0.8; // fração da largura
const LOGO_MAX_HEIGHT = 0.7; // fração da profundidade
const LOGO_STANDOFF = 0.004;
const BASE_COLOR = "#96c2e8";

function useRugTexture(): CanvasTexture {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = BASE_COLOR;
    ctx.fillRect(0, 0, size, size);
    // Fibras: posições determinísticas pra textura não mudar a cada render.
    let seed = 11;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    for (let i = 0; i < 1800; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 5, y + (rand() - 0.5) * 5);
      ctx.stroke();
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
  }, []);
}

function useRugGeometry(width: number, depth: number): ExtrudeGeometry {
  return useMemo(() => {
    const x = -width / 2;
    const y = -depth / 2;
    const r = Math.min(CORNER_RADIUS, width / 2, depth / 2);
    const shape = new Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + depth - r);
    shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
    shape.lineTo(x + r, y + depth);
    shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    const geometry = new ExtrudeGeometry(shape, {
      depth: THICKNESS - BEVEL * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: BEVEL,
      bevelThickness: BEVEL,
    });
    // De pé (extrusão em z) pra deitado (extrusão pra cima, em y), base em y = 0.
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, BEVEL, 0);
    return geometry;
  }, [width, depth]);
}

function Fringes({ width, depth }: { width: number; depth: number }) {
  const ref = useRef<InstancedMesh>(null);
  const perSide = Math.max(2, Math.round((depth - CORNER_RADIUS * 2) / FRINGE_SPACING));

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    let index = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const t = i / (perSide - 1) - 0.5;
        dummy.position.set(side * (width / 2 + FRINGE_LENGTH / 2 - 0.005), 0.004, t * (depth - CORNER_RADIUS * 2));
        // Leve desalinhamento, determinístico, pra parecer franja de verdade.
        dummy.rotation.set(0, Math.sin(index * 12.9898) * 0.12, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [width, depth, perSide]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, perSide * 2]} key={perSide} castShadow>
      <cylinderGeometry args={[0.003, 0.002, FRINGE_LENGTH, 5]} />
      <meshStandardMaterial color="#f4f1ea" roughness={0.95} />
    </instancedMesh>
  );
}

export function Rug({ width, depth, logo }: { width: number; depth: number; logo: SceneLogo | null }) {
  const texture = useRugTexture();
  const geometry = useRugGeometry(width, depth);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#ffffff" map={texture} roughness={0.95} metalness={0.05} />
      </mesh>
      <Fringes width={width} depth={depth} />
      {logo && (
        // Deitada sobre o tapete: a frente da logo olha pra cima, o topo pra -z.
        <group position={[0, THICKNESS, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <PlacedLogo
            logo={{ ...logo, style: "flat" }}
            place={(aspect, standoff) => {
              const h = Math.min(depth * LOGO_MAX_HEIGHT, (width * LOGO_MAX_WIDTH) / aspect);
              return { position: [0, 0, standoff + LOGO_STANDOFF], yaw: 0, width: h * aspect, height: h };
            }}
          />
        </group>
      )}
    </group>
  );
}
