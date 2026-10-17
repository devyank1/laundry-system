import { useMemo } from "react";
import { CanvasTexture, CatmullRomCurve3, ExtrudeGeometry, Shape, TubeGeometry, Vector3 } from "three";

// Portado de "Galoes amaciante lavadora.html": galão industrial de 5 L (corpo
// de caixa arredondada com frisos, ombro, alça, gargalo com tampa nervurada e
// rótulo na frente). Origem no centro da base, frente (rótulo) pra +z.
// Modelo em unidades arbitrárias; SCALE leva pra metros (~19 x 13 cm de base,
// ~33 cm de altura). A tampa fica em x = CAP_X (unidades) do centro.
export const JUG_SCALE = 0.15;
export const JUG_HEIGHT_M = (1.5 + 0.8) * JUG_SCALE;
export const JUG_CAP_LOCAL = new Vector3(-0.18, 1.5 + 0.74, 0); // topo da tampa

const BODY = { w: 1.25, d: 0.85, h: 1.5, r: 0.18 };

export type JugKind = "detergente" | "amaciante";

const JUG_STYLE: Record<JugKind, { body: string; top: string; title: string; sub: string; badge: string }> = {
  detergente: { body: "#3b5998", top: "#f5f5f7", title: "DETERGENTE", sub: "ALCALINO AZUL", badge: "#2563eb" },
  amaciante: { body: "#ededed", top: "#ffffff", title: "AMACIANTE", sub: "NEUTRO BRANCO", badge: "#059669" },
};

function roundedRectShape(width: number, height: number, radius: number): Shape {
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function useLabelTexture(kind: JugKind): CanvasTexture {
  return useMemo(() => {
    const { title, sub, badge } = JUG_STYLE[kind];
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#d0d4dc";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 240, 240);
    ctx.fillStyle = badge;
    ctx.fillRect(16, 20, 224, 40);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("LAVANDERIA", 128, 48);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(title, 128, 100);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.fillText(sub, 128, 124);
    ctx.fillStyle = badge;
    ctx.beginPath();
    ctx.arc(128, 170, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("5L", 128, 176);
    ctx.fillStyle = "#0f172a";
    ctx.font = "10px sans-serif";
    ctx.fillText("USO PROFISSIONAL • CONCENTRADO", 128, 220);
    return new CanvasTexture(canvas);
  }, [kind]);
}

function useJugGeometry() {
  return useMemo(() => {
    const body = new ExtrudeGeometry(roundedRectShape(BODY.w, BODY.d, BODY.r), {
      depth: BODY.h,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    body.center();
    const handle = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.32, BODY.h + 0.05, 0),
        new Vector3(0.48, BODY.h + 0.35, 0),
        new Vector3(0.38, BODY.h + 0.68, 0),
        new Vector3(0.08, BODY.h + 0.72, 0),
      ]),
      24,
      0.09,
      16,
      false
    );
    return { body, handle };
  }, []);
}

export function Jug({ kind }: { kind: JugKind }) {
  const style = JUG_STYLE[kind];
  const geo = useJugGeometry();
  const label = useLabelTexture(kind);

  return (
    <group scale={JUG_SCALE}>
      {/* Corpo */}
      <mesh geometry={geo.body} rotation={[Math.PI / 2, 0, 0]} position={[0, BODY.h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={style.body} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Frisos de reforço */}
      {[-0.4, -0.1, 0.2].map((y) => (
        <mesh key={y} position={[0, BODY.h / 2 + y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 0.75, 1]} castShadow>
          <torusGeometry args={[0.52, 0.025, 8, 32]} />
          <meshStandardMaterial color={style.body} roughness={0.7} metalness={0.05} />
        </mesh>
      ))}
      {/* Ombro */}
      <mesh position={[0, BODY.h + 0.225, 0]} scale={[1.1, 1, 0.8]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.62, 0.45, 32]} />
        <meshStandardMaterial color={style.top} roughness={0.45} metalness={0.02} />
      </mesh>
      {/* Alça */}
      <mesh geometry={geo.handle} scale={[1, 1, 0.75]} castShadow>
        <meshStandardMaterial color={style.top} roughness={0.45} metalness={0.02} />
      </mesh>
      {/* Gargalo e tampa nervurada */}
      <mesh position={[-0.18, BODY.h + 0.52, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.22, 32]} />
        <meshStandardMaterial color={style.top} roughness={0.45} metalness={0.02} />
      </mesh>
      <mesh position={[-0.18, BODY.h + 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.18, 32]} />
        <meshStandardMaterial color="#ffffff" roughness={0.35} metalness={0.05} />
      </mesh>
      {/* Rótulo */}
      <mesh position={[0, BODY.h / 2 + 0.02, BODY.d / 2 + 0.045]}>
        <planeGeometry args={[0.88, 1.0]} />
        <meshStandardMaterial map={label} roughness={0.3} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  );
}
