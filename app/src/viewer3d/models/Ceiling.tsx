import type { Layout } from "../../engine/types";
import { ROOM_WALL_THICKNESS } from "../facade";
import { CEILING_PANEL_SIZE_M, ceilingLightPositions } from "../lighting";

const ROOF_THICKNESS = 0.12; // laje

// Forro e painéis: planos voltados pra BAIXO (normal -y), vistos de dentro.
// A laje por cima (`showRoof`) é o teto visto de fora; desligada, dá pra ver
// o interior de cima.
const FACE_DOWN: [number, number, number] = [Math.PI / 2, 0, 0];

// Teto básico (forro branco) com painéis de LED 60x60, cada um com uma luz
// de verdade iluminando a loja.
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
          <meshStandardMaterial color="#cbd5e1" roughness={0.95} />
        </mesh>
      )}
      <mesh position={[w / 2, h, d / 2]} rotation={FACE_DOWN} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>

      {ceilingLightPositions(layout).map(([x, z]) => (
        <group key={`${x}-${z}`}>
          <mesh position={[x, h - 0.004, z]} rotation={FACE_DOWN}>
            <planeGeometry args={[CEILING_PANEL_SIZE_M, CEILING_PANEL_SIZE_M]} />
            {/* toneMapped=false: o painel "estoura" de branco, parece aceso */}
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fff8e7"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[x, h - 0.25, z]}
            color="#fff4dc"
            intensity={panelIntensity}
            distance={6}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}
