import type { Layout } from "../../engine/types";
import { ROOM_WALL_THICKNESS } from "../facade";
import { CEILING_PANEL_SIZE_M, ceilingLightPositions, clusterLights } from "../lighting";
import { StdMat } from "./SharedMaterial";

const ROOF_THICKNESS = 0.12; // laje

// Forro e painéis: planos voltados pra BAIXO (normal -y), vistos de dentro.
// A laje por cima (`showRoof`) é o teto visto de fora; desligada, dá pra ver
// o interior de cima.
const FACE_DOWN: [number, number, number] = [Math.PI / 2, 0, 0];

// Teto básico (forro branco) com painéis de LED 60x60. As luzes de verdade
// são poucas (até 2x2, ver clusterLights): cada uma pesa em todo pixel.
export function Ceiling({
  layout,
  panelIntensity,
  showRoof,
}: {
  layout: Layout;
  panelIntensity: number;
  showRoof: boolean;
}) {
  const w = layout.roomWidthMm / 1000;
  const d = layout.roomDepthMm / 1000;
  const h = layout.ceilingHeightMm / 1000;
  const panels = ceilingLightPositions(layout);

  return (
    <group>
      {showRoof && (
        // Laje cobrindo até a face externa das paredes do fundo e laterais
        // (a frente é coberta pela fachada).
        <mesh
          position={[w / 2, h + ROOF_THICKNESS / 2 + 0.002, (d - ROOM_WALL_THICKNESS) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[w + ROOM_WALL_THICKNESS * 2, ROOF_THICKNESS, d + ROOM_WALL_THICKNESS]}
          />
          <StdMat color="#cbd5e1" roughness={0.95} />
        </mesh>
      )}
      <mesh position={[w / 2, h, d / 2]} rotation={FACE_DOWN} receiveShadow>
        <planeGeometry args={[w, d]} />
        <StdMat color="#f8fafc" roughness={0.9} />
      </mesh>

      {panels.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, h - 0.004, z]} rotation={FACE_DOWN}>
          <planeGeometry args={[CEILING_PANEL_SIZE_M, CEILING_PANEL_SIZE_M]} />
          {/* toneMapped=false: o painel "estoura" de branco, parece aceso */}
          <StdMat color="#ffffff" emissive="#fff8e7" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}
      {clusterLights(panels).map(([x, z, n]) => (
        <pointLight
          key={`light-${x}-${z}`}
          position={[x, h - 0.25, z]}
          color="#fff4dc"
          intensity={panelIntensity * n}
          distance={6 + Math.sqrt(n)}
          decay={2}
        />
      ))}
    </group>
  );
}
