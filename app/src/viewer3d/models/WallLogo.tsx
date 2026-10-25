import { useEffect, useMemo, useState } from "react";
import {
  ExtrudeGeometry,
  Path,
  Shape,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  type Texture,
} from "three";
import type { Layout } from "../../engine/types";
import type { LogoSideColor, LogoStyle } from "../../state/projectStore";
import { alphaFromRGBA, traceLogo, type LogoOutline } from "../logoShape";
import { logoPlacement, type LogoPlacement } from "../placement";
import { StdMat } from "./SharedMaterial";

export interface SceneLogo {
  url: string;
  style: LogoStyle;
  depthMm: number;
  sideColor: LogoSideColor;
}

// Resolução máxima usada pra achar o contorno: mais que isso só deixa lento,
// e serrilhado de pixel some com a simplificação.
const TRACE_MAX_PX = 320;
const LETTER_STANDOFF_M = 0.02; // letreiro afastado 2cm da parede
const FLAT_STANDOFF_M = 0.006;

const SIDE_MATERIAL: Record<LogoSideColor, { color: string; metalness: number; roughness: number }> = {
  white: { color: "#f8fafc", metalness: 0, roughness: 0.5 },
  black: { color: "#111827", metalness: 0.1, roughness: 0.5 },
  steel: { color: "#c0c4c8", metalness: 0.9, roughness: 0.3 },
};

function traceImage(image: HTMLImageElement): LogoOutline | null {
  const scale = Math.min(1, TRACE_MAX_PX / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, w, h);
  return traceLogo(alphaFromRGBA(ctx.getImageData(0, 0, w, h).data, w, h));
}

function buildGeometry(outline: LogoOutline, depthM: number): ExtrudeGeometry | null {
  const shapes = outline.shapes.map((s) => {
    const shape = new Shape(s.outer.map((p) => new Vector2(p.x, p.y)));
    shape.holes = s.holes.map((hole) => new Path(hole.map((p) => new Vector2(p.x, p.y))));
    return shape;
  });
  try {
    // Formas em coordenadas normalizadas da imagem → as UVs da frente já
    // batem com a textura. Escala real em x/y vem do <mesh scale>.
    return new ExtrudeGeometry(shapes, { depth: depthM, bevelEnabled: false, curveSegments: 1 });
  } catch {
    return null;
  }
}

// Logo do local (PNG transparente) no drywall, em cima da fileira de máquinas.
export function WallLogo({ layout, logo }: { layout: Layout; logo: SceneLogo }) {
  return (
    <PlacedLogo logo={logo} place={(aspect, standoff) => logoPlacement(layout, aspect, standoff)} />
  );
}

// Logo como letreiro 3D (contorno extrudado, frente com as cores da logo) ou
// adesivo. `place` decide onde/quanto mede a partir da proporção da parte
// visível da logo e do afastamento da parede.
export function PlacedLogo({
  logo,
  place,
}: {
  logo: SceneLogo;
  place: (aspect: number, standoffM: number) => LogoPlacement | null;
}) {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: Texture | null = null;
    new TextureLoader().load(logo.url, (t) => {
      t.colorSpace = SRGBColorSpace;
      loaded = t;
      if (cancelled) t.dispose();
      else setTexture(t);
    });
    return () => {
      cancelled = true;
      loaded?.dispose();
      setTexture(null);
    };
  }, [logo.url]);

  const image = texture?.image as HTMLImageElement | undefined;
  // O contorno (trace) só serve pro letreiro 3D: logo "flat" (tapetes, adesivo) não paga por ele.
  const outline = useMemo(() => (image && logo.style === "3d" ? traceImage(image) : null), [image, logo.style]);
  const geometry = useMemo(
    () => (outline && logo.style === "3d" ? buildGeometry(outline, logo.depthMm / 1000) : null),
    [outline, logo.style, logo.depthMm]
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!texture || !image) return null;

  if (geometry && outline) {
    const { minX, minY, maxX, maxY } = outline.bbox;
    const aspect = ((maxX - minX) * image.width) / ((maxY - minY) * image.height);
    const placement = place(aspect, LETTER_STANDOFF_M);
    if (!placement) return null;
    const sx = placement.width / (maxX - minX);
    const sy = placement.height / (maxY - minY);
    const side = SIDE_MATERIAL[logo.sideColor];
    return (
      <group position={placement.position} rotation={[0, placement.yaw, 0]}>
        <mesh
          geometry={geometry}
          scale={[sx, sy, 1]}
          position={[(-(minX + maxX) / 2) * sx, (-(minY + maxY) / 2) * sy, 0]}
          castShadow
        >
          {/* grupo 0 = frente/fundo (com a logo), grupo 1 = laterais */}
          <StdMat attach="material-0" map={texture} roughness={0.5} />
          <StdMat
            attach="material-1"
            color={side.color}
            metalness={side.metalness}
            roughness={side.roughness}
          />
        </mesh>
      </group>
    );
  }

  const placement = place(image.width / image.height, FLAT_STANDOFF_M);
  if (!placement) return null;
  return (
    <mesh position={placement.position} rotation={[0, placement.yaw, 0]}>
      <planeGeometry args={[placement.width, placement.height]} />
      <StdMat map={texture} transparent alphaTest={0.05} roughness={0.6} />
    </mesh>
  );
}
