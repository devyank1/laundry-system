import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import { useLerpedVector3 } from "./useLerpedVector3";
import {
  CHAIR_HEIGHT_MM,
  DRYWALL_THICKNESS_MM,
  TECH_DOOR_HEIGHT_MM,
  TOTEM_MOUNT_CENTER_MM,
  TOTEM_SIZE_MM,
} from "../engine/constants";
import type { Layout, PlacedMachine } from "../engine/types";
import { PLAN_COLORS } from "../viewer2d/planTheme";
import { Chair } from "./models/Chair";
import { FitBox } from "./models/FitBox";
import { machineModelFor } from "./models/machineModel";
import { PaymentTotem } from "./models/PaymentTotem";
import { SpeedQueenStack } from "./models/SpeedQueenStack";
import { SplitAC } from "./models/SplitAC";
import { StainlessTable } from "./models/StainlessTable";
import { TowerMachine } from "./models/TowerMachine";

const M = (mmValue: number) => mmValue / 1000;

const TABLE_HEIGHT_MM = 900;
const AC_UNIT_HEIGHT_MM = 300;
const AC_CEILING_GAP_MM = 150;
const WALL_THICKNESS = 0.1;
const DOOR_JAMB = 0.025;
const DOOR_LEAF_THICKNESS = 0.04;

const LEGEND = [
  { label: "Drywall: Azul Claro Embutido", color: PLAN_COLORS.drywall },
  { label: "Speed Queen / Mamute 10: Brancas", color: PLAN_COLORS.machineWhite },
  { label: "Mamute 17kg: Prata", color: "#cccccc" },
  { label: "Porta Técnica 0,70m", color: PLAN_COLORS.door },
  { label: "Totem PagLave (embutido)", color: "#84cc16" },
  { label: "Ar-condicionado no salão", color: "#ffffff" },
  { label: "Cadeiras", color: "#64748b" },
];

function Box({
  position,
  size,
  color,
  opacity,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  opacity?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  );
}

function MachineMesh({ catalogId, x, y, widthMm, depthMm, heightMm }: PlacedMachine) {
  const w = M(widthMm);
  const d = M(depthMm);
  const h = M(heightMm);
  const targetPosition = useLerpedVector3([M(x) + w / 2, 0, M(y) + d / 2]);
  const groupRef = useRef<Group>(null);
  const model = machineModelFor(catalogId);

  useFrame(() => {
    groupRef.current?.position.copy(targetPosition);
  });

  return (
    <group ref={groupRef} position={targetPosition}>
      <FitBox size={[w, h, d]}>
        {model.kind === "speedQueen" ? <SpeedQueenStack /> : <TowerMachine finish={model.finish} />}
      </FitBox>
    </group>
  );
}

// Divide a faixa [from, to] removendo os vãos (aberturas das máquinas).
function solidSpans(from: number, to: number, gaps: { start: number; end: number }[]) {
  const spans: { start: number; end: number }[] = [];
  let cursor = from;
  for (const gap of [...gaps].sort((a, b) => a.start - b.start)) {
    if (gap.end <= from || gap.start >= to) continue;
    if (gap.start > cursor) spans.push({ start: cursor, end: gap.start });
    cursor = Math.max(cursor, gap.end);
  }
  if (cursor < to) spans.push({ start: cursor, end: to });
  return spans;
}

function Drywall({ layout }: { layout: Layout }) {
  const wallH = M(layout.drywall.heightMm);
  const thickness = M(DRYWALL_THICKNESS_MM);
  const z = M(layout.drywall.y) + thickness / 2;
  const corridor = layout.techCorridor;

  const gaps = [
    ...layout.drywall.openings.map((o) => ({ start: o.x, end: o.x + o.width })),
    { start: corridor.x, end: corridor.x + corridor.width },
  ];

  return (
    <>
      {solidSpans(0, layout.roomWidthMm, gaps).map((s) => (
        <Box
          key={`span-${s.start}`}
          position={[M((s.start + s.end) / 2), wallH / 2, z]}
          size={[M(s.end - s.start), wallH, thickness]}
          color={PLAN_COLORS.drywall}
        />
      ))}

      {layout.drywall.openings.map((o) => {
        const lintelH = wallH - M(o.height);
        return lintelH > 0 ? (
          <Box
            key={`lintel-${o.x}`}
            position={[M(o.x + o.width / 2), M(o.height) + lintelH / 2, z]}
            size={[M(o.width), lintelH, thickness]}
            color={PLAN_COLORS.drywall}
          />
        ) : null;
      })}

      <TechDoor layout={layout} wallH={wallH} z={z} thickness={thickness} />
    </>
  );
}

// Porta técnica de 70cm no drywall: batente, folha grossa e maçaneta do lado oposto à dobradiça.
function TechDoor({
  layout,
  wallH,
  z,
  thickness,
}: {
  layout: Layout;
  wallH: number;
  z: number;
  thickness: number;
}) {
  const door = layout.techDoor;
  const x0 = M(door.x);
  const w = M(door.width);
  const doorH = Math.min(M(TECH_DOOR_HEIGHT_MM), wallH);
  const leafW = w - DOOR_JAMB * 2;
  const leafH = doorH - DOOR_JAMB;
  const frameDepth = thickness + 0.02;
  const hingeOnLeft = door.x === 0;
  const handleX = hingeOnLeft ? x0 + w - DOOR_JAMB - 0.07 : x0 + DOOR_JAMB + 0.07;
  const leafFront = z + DOOR_LEAF_THICKNESS / 2;

  return (
    <>
      {/* Batente */}
      {[x0 + DOOR_JAMB / 2, x0 + w - DOOR_JAMB / 2].map((x) => (
        <Box key={x} position={[x, doorH / 2, z]} size={[DOOR_JAMB, doorH, frameDepth]} color="#e5e7eb" />
      ))}
      <Box
        position={[x0 + w / 2, doorH - DOOR_JAMB / 2, z]}
        size={[w, DOOR_JAMB, frameDepth]}
        color="#e5e7eb"
      />

      {/* Folha */}
      <Box
        position={[x0 + w / 2, leafH / 2, z]}
        size={[leafW, leafH, DOOR_LEAF_THICKNESS]}
        color={PLAN_COLORS.door}
      />

      {/* Maçaneta dos dois lados */}
      {[1, -1].map((dir) => (
        <group key={dir} position={[handleX, 1.0, z + dir * (DOOR_LEAF_THICKNESS / 2 + 0.03)]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.009, 0.009, 0.12, 12]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      ))}
      <mesh position={[handleX, 1.0, leafFront + 0.002]}>
        <cylinderGeometry args={[0.03, 0.03, 0.06, 16]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.25} />
      </mesh>

      {/* Drywall acima da porta */}
      {wallH > doorH && (
        <Box
          position={[x0 + w / 2, doorH + (wallH - doorH) / 2, z]}
          size={[w, wallH - doorH, thickness]}
          color={PLAN_COLORS.drywall}
        />
      )}
    </>
  );
}

export function Scene({
  layout,
  onCanvasReady,
}: {
  layout: Layout;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}) {
  const roomW = M(layout.roomWidthMm);
  const roomD = M(layout.roomDepthMm);
  const roomH = M(layout.ceilingHeightMm);
  const span = Math.max(roomW, roomD);
  const gridSize = Math.ceil(span) + 4;

  return (
    <div className="scene3d">
      <Canvas
        shadows
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [roomW / 2, span * 1.3, roomD + span * 0.9], fov: 45 }}
        onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
      >
        <color attach="background" args={[PLAN_COLORS.background]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[roomW, roomH * 3, roomD * 1.5]} intensity={1} castShadow />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomW / 2, 0, roomD / 2]} receiveShadow>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <gridHelper
          args={[gridSize, gridSize * 2, "#cbd5e1", "#94a3b8"]}
          position={[roomW / 2, 0.002, roomD / 2]}
        />

        {/* Paredes: fundo e laterais; a frente fica aberta para ver o interior */}
        <Box
          position={[roomW / 2, roomH / 2, -WALL_THICKNESS / 2]}
          size={[roomW + WALL_THICKNESS * 2, roomH, WALL_THICKNESS]}
          color={PLAN_COLORS.wall}
        />
        <Box
          position={[-WALL_THICKNESS / 2, roomH / 2, roomD / 2]}
          size={[WALL_THICKNESS, roomH, roomD]}
          color={PLAN_COLORS.wall}
        />
        <Box
          position={[roomW + WALL_THICKNESS / 2, roomH / 2, roomD / 2]}
          size={[WALL_THICKNESS, roomH, roomD]}
          color={PLAN_COLORS.wall}
        />

        <Drywall layout={layout} />

        {layout.machines.map((machine) => (
          <MachineMesh key={`${machine.catalogId}-${machine.instanceIndex}`} {...machine} />
        ))}

        {layout.frontDoor && (
          <Box
            position={[M(layout.frontDoor.x + layout.frontDoor.width / 2), 0.01, roomD]}
            size={[M(layout.frontDoor.width), 0.02, 0.12]}
            color={PLAN_COLORS.door}
          />
        )}

        {layout.furniture && (
          <>
            {/* Totem embutido no drywall, centro da tela a 1,20m do chão */}
            <group
              position={[
                M(layout.furniture.totem.x + layout.furniture.totem.width / 2),
                M(TOTEM_MOUNT_CENTER_MM - TOTEM_SIZE_MM.height / 2),
                M(layout.drywall.y + DRYWALL_THICKNESS_MM) + M(TOTEM_SIZE_MM.depth) / 2 - 0.03,
              ]}
            >
              <FitBox
                size={[
                  M(TOTEM_SIZE_MM.width),
                  M(TOTEM_SIZE_MM.height),
                  M(TOTEM_SIZE_MM.depth),
                ]}
              >
                <PaymentTotem />
              </FitBox>
            </group>
            <group
              position={[
                M(layout.furniture.table.x + layout.furniture.table.width / 2),
                0,
                M(layout.furniture.table.y + layout.furniture.table.height / 2),
              ]}
            >
              {/* Mesa virada: comprimento (2m) entra sala adentro, perpendicular
                  à parede — já bate com a orientação nativa do modelo, sem rotação. */}
              <FitBox
                size={[
                  M(layout.furniture.table.width),
                  M(TABLE_HEIGHT_MM),
                  M(layout.furniture.table.height),
                ]}
              >
                <StainlessTable />
              </FitBox>
            </group>
            {layout.furniture.poufs.map((p, i) => (
              <group
                key={i}
                position={[M(p.x + p.width / 2), 0, M(p.y + p.height / 2)]}
                rotation={[0, layout.furniture!.acWall === "left" ? Math.PI / 2 : -Math.PI / 2, 0]}
              >
                <FitBox size={[M(p.width), M(CHAIR_HEIGHT_MM), M(p.height)]}>
                  <Chair />
                </FitBox>
              </group>
            ))}
            {/* Ar-condicionado na parede lateral do salão, virado para dentro da loja */}
            <group
              position={[
                M(layout.furniture.ac.x + layout.furniture.ac.width / 2),
                roomH - M(AC_CEILING_GAP_MM + AC_UNIT_HEIGHT_MM),
                M(layout.furniture.ac.y + layout.furniture.ac.height / 2),
              ]}
              rotation={[0, layout.furniture.acWall === "left" ? Math.PI / 2 : -Math.PI / 2, 0]}
            >
              <FitBox
                size={[M(layout.furniture.ac.height), M(AC_UNIT_HEIGHT_MM), M(layout.furniture.ac.width)]}
              >
                <SplitAC />
              </FitBox>
            </group>
          </>
        )}

        {/* Reflexos para os metais (inox, prata) sem baixar HDR da internet */}
        <Environment resolution={64}>
          <Lightformer intensity={1.5} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
          <Lightformer intensity={0.8} position={[0, 2, 6]} scale={[10, 3, 1]} />
          <Lightformer intensity={0.5} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        </Environment>

        <OrbitControls
          target={[roomW / 2, 0, roomD / 2]}
          enableDamping
          dampingFactor={0.1}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>

      <ul className="plan-legend">
        {LEGEND.map((item) => (
          <li key={item.label}>
            <span className="plan-legend-swatch" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
