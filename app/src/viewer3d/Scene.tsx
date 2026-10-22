import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
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
import { drywallFrame, fitSize, rectCenter, wallYaw, type DrywallFrame } from "./placement";
import { PLAN_COLORS } from "../viewer2d/planTheme";
import { Chair } from "./models/Chair";
import { FitBox } from "./models/FitBox";
import { machineModelFor } from "./models/machineModel";
import { PaymentTotem } from "./models/PaymentTotem";
import { SpeedQueenStack } from "./models/SpeedQueenStack";
import { SplitAC } from "./models/SplitAC";
import { StainlessTable } from "./models/StainlessTable";
import { TowerMachine } from "./models/TowerMachine";
import { WallLogo, type SceneLogo } from "./models/WallLogo";
import { Facade } from "./models/Facade";
import { ROOM_WALL_THICKNESS } from "./facade";
import { Ceiling } from "./models/Ceiling";
import { CameraRig } from "./CameraRig";
import { LIGHTING_PRESETS, type SceneLighting } from "./lighting";
import { drywallColorFor } from "./colors";
import { Inauguracao } from "./models/Inauguracao";
import { Electrical } from "./models/Electrical";
import { Hydraulics } from "./models/Hydraulics";
import { Exhaust } from "./models/Exhaust";
import { Rug } from "./models/Rug";
import { TrashCan } from "./models/TrashCan";
import { Dispensers } from "./models/Dispensers";
import { DISPENSER_MOUNT_HEIGHT, placeStoreFixtures } from "./rugs";
import { PoufSet } from "./models/PoufSet";
import { CounterWithStools } from "./models/CounterWithStools";

const M = (mmValue: number) => mmValue / 1000;

// Parede do fundo escondida por enquanto: deixa ver a área técnica (exaustão,
// água, esgoto e dosagem) pelas costas. Voltar a `true` pra fechar a loja.
const SHOW_BACK_WALL = false;

const TABLE_HEIGHT_MM = 900;
const AC_UNIT_HEIGHT_MM = 300;
const AC_CEILING_GAP_MM = 150;
const DOOR_JAMB = 0.025;
const DOOR_LEAF_THICKNESS = 0.04;
const CONCRETE_BASE_MARGIN = 0.02; // base de concreto passa 2 cm da máquina

// Drywall no 3D: tom mais escuro da cor da fachada (padrão #8fa892 → #5b765f).
const DEFAULT_DRYWALL_COLOR = drywallColorFor("#8fa892");

const LEGEND = [
  { label: "Speed Queen / Mamute 10: Brancas", color: PLAN_COLORS.machineWhite },
  { label: "Mamute 17kg: Prata", color: "#cccccc" },
  { label: "Porta Técnica 0,70m", color: PLAN_COLORS.door },
  { label: "Totem PagLave (embutido)", color: "#84cc16" },
  { label: "Ar-condicionado no salão", color: "#ffffff" },
  { label: "Cadeiras", color: "#64748b" },
  { label: "Exaustão das secadoras (duto semirrígido)", color: "#aeb4ba" },
  { label: "Água: pressurizador e barramento", color: "#3182ce" },
  { label: "Esgoto: tubo suspenso (sem ralo) e respiro", color: "#d9d2c3" },
  { label: "Elétrica suspensa: perfilado de alumínio, Steck, 220 V e 127 V", color: "#c5cbd1" },
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

// `yaw` vira a frente da máquina pro salão (0 em "back"; ±90° em "side").
function MachineMesh({
  catalogId,
  x,
  y,
  widthMm,
  depthMm,
  heightMm,
  baseMm,
  yaw,
}: PlacedMachine & { yaw: number }) {
  const w = M(widthMm);
  const d = M(depthMm);
  const h = M(heightMm);
  const base = M(baseMm);
  const targetPosition = useLerpedVector3([M(x) + w / 2, 0, M(y) + d / 2]);
  const groupRef = useRef<Group>(null);
  const model = machineModelFor(catalogId);

  useFrame(() => {
    groupRef.current?.position.copy(targetPosition);
  });

  return (
    <group ref={groupRef} position={targetPosition}>
      {/* Máquina pesada: base de concreto de 2 cm embaixo (um pouco maior que ela) */}
      {base > 0 && (
        <mesh position={[0, base / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + CONCRETE_BASE_MARGIN * 2, base, d + CONCRETE_BASE_MARGIN * 2]} />
          <meshStandardMaterial color="#a8a29e" roughness={0.95} />
        </mesh>
      )}
      <group position={[0, base, 0]} rotation={[0, yaw, 0]}>
        <FitBox size={fitSize(w, h, d, yaw)}>
          {model.kind === "speedQueen" ? <SpeedQueenStack /> : <TowerMachine finish={model.finish} />}
        </FitBox>
      </group>
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

// Drywall com vãos das máquinas e do corredor técnico. Tudo é montado no
// referencial (along, across) da fileira — `frame` converte pro mundo, então
// o mesmo código serve pra fileira no fundo ou em qualquer parede lateral.
function Drywall({ layout, color }: { layout: Layout; color: string }) {
  const frame = drywallFrame(layout);
  const wallH = M(layout.drywall.heightMm);
  const thickness = M(DRYWALL_THICKNESS_MM);
  const across = M(layout.drywall.y) + thickness / 2;

  const gaps = [
    ...layout.drywall.openings.map(frame.markerSpan),
    frame.spatialSpan(layout.techCorridor),
  ];

  return (
    <>
      {solidSpans(0, frame.alongLength, gaps).map((s) => (
        <Box
          key={`span-${s.start}`}
          position={frame.pos((s.start + s.end) / 2, wallH / 2, across)}
          size={frame.size(s.end - s.start, wallH, thickness)}
          color={color}
        />
      ))}

      {layout.drywall.openings.map((o) => {
        const span = frame.markerSpan(o);
        const lintelH = wallH - M(o.height);
        return lintelH > 0 ? (
          <Box
            key={`lintel-${span.start}`}
            position={frame.pos((span.start + span.end) / 2, M(o.height) + lintelH / 2, across)}
            size={frame.size(span.end - span.start, lintelH, thickness)}
            color={color}
          />
        ) : null;
      })}

      <TechDoor
        layout={layout}
        frame={frame}
        wallH={wallH}
        across={across}
        thickness={thickness}
        wallColor={color}
      />
    </>
  );
}

// Porta técnica de 70cm no drywall: batente, folha grossa e maçaneta do lado oposto à dobradiça.
function TechDoor({
  layout,
  frame,
  wallH,
  across,
  thickness,
  wallColor,
}: {
  layout: Layout;
  frame: DrywallFrame;
  wallH: number;
  across: number;
  thickness: number;
  wallColor: string;
}) {
  const span = frame.markerSpan(layout.techDoor);
  const a0 = span.start;
  const w = span.end - span.start;
  const doorH = Math.min(M(TECH_DOOR_HEIGHT_MM), wallH);
  const leafW = w - DOOR_JAMB * 2;
  const leafH = doorH - DOOR_JAMB;
  const frameDepth = thickness + 0.02;
  const hingeAtStart = a0 === 0;
  const handleA = hingeAtStart ? a0 + w - DOOR_JAMB - 0.07 : a0 + DOOR_JAMB + 0.07;
  const leafFront = across + DOOR_LEAF_THICKNESS / 2;

  return (
    <>
      {/* Batente */}
      {[a0 + DOOR_JAMB / 2, a0 + w - DOOR_JAMB / 2].map((a) => (
        <Box
          key={a}
          position={frame.pos(a, doorH / 2, across)}
          size={frame.size(DOOR_JAMB, doorH, frameDepth)}
          color="#e5e7eb"
        />
      ))}
      <Box
        position={frame.pos(a0 + w / 2, doorH - DOOR_JAMB / 2, across)}
        size={frame.size(w, DOOR_JAMB, frameDepth)}
        color="#e5e7eb"
      />

      {/* Folha */}
      <Box
        position={frame.pos(a0 + w / 2, leafH / 2, across)}
        size={frame.size(leafW, leafH, DOOR_LEAF_THICKNESS)}
        color={PLAN_COLORS.door}
      />

      {/* Maçaneta dos dois lados */}
      {[1, -1].map((dir) => (
        <group
          key={dir}
          position={frame.pos(handleA, 1.0, across + dir * (DOOR_LEAF_THICKNESS / 2 + 0.03))}
        >
          <mesh rotation={frame.alongBarRotation}>
            <cylinderGeometry args={[0.009, 0.009, 0.12, 12]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      ))}
      <mesh position={frame.pos(handleA, 1.0, leafFront + 0.002)}>
        <cylinderGeometry args={[0.03, 0.03, 0.06, 16]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.25} />
      </mesh>

      {/* Drywall acima da porta */}
      {wallH > doorH && (
        <Box
          position={frame.pos(a0 + w / 2, doorH + (wallH - doorH) / 2, across)}
          size={frame.size(w, wallH - doorH, thickness)}
          color={wallColor}
        />
      )}
    </>
  );
}

export function Scene({
  layout,
  logo,
  facade,
  lighting = "day",
  showRoof = true,
  tourRun = null,
  inauguracao = false,
  drywallColor = DEFAULT_DRYWALL_COLOR,
  onCanvasReady,
}: {
  layout: Layout;
  // Logo do local (PNG transparente), no drywall em cima das máquinas.
  logo?: SceneLogo | null;
  // Fachada na parede da frente (null = escondida).
  facade?: { wallColor: string; signColor: string } | null;
  // Cor do drywall (acompanha a cor da fachada, mesmo com ela escondida).
  drywallColor?: string;
  // Dia (sol + reflexos) ou noite (só as luzes da loja acesas).
  lighting?: SceneLighting;
  // Laje do teto vista de fora (desligar pra ver o interior de cima).
  showRoof?: boolean;
  // "Visão do cliente": cada número novo (re)começa o passeio; null = órbita livre.
  tourRun?: number | null;
  // Modo inauguração: balões, carrinho de pipoca, balcão, lembranças e dispensers.
  inauguracao?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}) {
  const roomW = M(layout.roomWidthMm);
  const roomD = M(layout.roomDepthMm);
  const roomH = M(layout.ceilingHeightMm);
  const span = Math.max(roomW, roomD);
  const gridSize = Math.ceil(span) + 4;
  const frame = drywallFrame(layout);
  const furniture = layout.furniture;
  const light = LIGHTING_PRESETS[lighting];
  const fixtures = placeStoreFixtures(layout);
  const orbitPosition: [number, number, number] = [roomW / 2, span * 1.3, roomD + span * 0.9];

  return (
    <div className="scene3d">
      <Canvas
        shadows
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: orbitPosition, fov: 45 }}
        onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
      >
        <color attach="background" args={[light.background]} />
        <ambientLight intensity={light.ambient} />
        <directionalLight
          position={[roomW, roomH * 3, roomD * 1.5]}
          intensity={light.sun}
          castShadow
        />
        <Ceiling layout={layout} panelIntensity={light.panelLight} showRoof={showRoof} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomW / 2, 0, roomD / 2]} receiveShadow>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <gridHelper
          args={[gridSize, gridSize * 2, "#cbd5e1", "#94a3b8"]}
          position={[roomW / 2, 0.002, roomD / 2]}
        />

        {/* Paredes: laterais (e o fundo, quando SHOW_BACK_WALL); a frente fica
            aberta para ver o interior */}
        {SHOW_BACK_WALL && (
          <Box
            position={[roomW / 2, roomH / 2, -ROOM_WALL_THICKNESS / 2]}
            size={[roomW + ROOM_WALL_THICKNESS * 2, roomH, ROOM_WALL_THICKNESS]}
            color={PLAN_COLORS.wall}
          />
        )}
        <Box
          position={[-ROOM_WALL_THICKNESS / 2, roomH / 2, roomD / 2]}
          size={[ROOM_WALL_THICKNESS, roomH, roomD]}
          color={PLAN_COLORS.wall}
        />
        <Box
          position={[roomW + ROOM_WALL_THICKNESS / 2, roomH / 2, roomD / 2]}
          size={[ROOM_WALL_THICKNESS, roomH, roomD]}
          color={PLAN_COLORS.wall}
        />

        {/* Fileira na parede lateral: a área técnica encosta na fachada (que
            fica aberta pra ver o interior). Fecha esse trecho pra não parecer
            uma segunda entrada — o único acesso à área técnica é a porta técnica. */}
        {layout.orientation === "side" &&
          !facade &&
          (() => {
            const techAcross = M(layout.drywall.y + DRYWALL_THICKNESS_MM);
            return (
              <Box
                position={frame.pos(roomD + ROOM_WALL_THICKNESS / 2, roomH / 2, techAcross / 2)}
                size={frame.size(ROOM_WALL_THICKNESS, roomH, techAcross)}
                color={PLAN_COLORS.wall}
              />
            );
          })()}

        <Drywall layout={layout} color={drywallColor} />
        {layout.exhaust && <Exhaust layout={layout} exhaust={layout.exhaust} />}
        {layout.hydraulics && <Hydraulics layout={layout} hydraulics={layout.hydraulics} />}
        {layout.electrical && <Electrical layout={layout} electrical={layout.electrical} />}
        {logo && <WallLogo layout={layout} logo={logo} />}
        {facade && (
          <Facade
            layout={layout}
            wallColor={facade.wallColor}
            signColor={facade.signColor}
            logo={logo}
            spotIntensity={light.facadeSpot}
          />
        )}

        {layout.machines.map((machine) => (
          <MachineMesh
            key={`${machine.catalogId}-${machine.instanceIndex}`}
            {...machine}
            yaw={frame.yaw}
          />
        ))}

        {layout.frontDoor && (
          <Box
            position={[M(layout.frontDoor.x + layout.frontDoor.width / 2), 0.01, roomD]}
            size={[M(layout.frontDoor.width), 0.02, 0.12]}
            color={PLAN_COLORS.door}
          />
        )}

        {furniture && (
          <>
            {/* Totem embutido no drywall, centro da tela a 1,20m do chão, virado pro salão */}
            <group
              position={frame.pos(
                (frame.spatialSpan(furniture.totem).start + frame.spatialSpan(furniture.totem).end) / 2,
                M(TOTEM_MOUNT_CENTER_MM - TOTEM_SIZE_MM.height / 2),
                M(layout.drywall.y + DRYWALL_THICKNESS_MM) + M(TOTEM_SIZE_MM.depth) / 2 - 0.03
              )}
              rotation={[0, frame.yaw, 0]}
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
            {(() => {
              // Mesa: 2m nativos em x. Em "side" o comprimento corre em z
              // (ao longo da parede lateral), então gira 90°.
              const t = furniture.table;
              const yaw = layout.orientation === "side" ? Math.PI / 2 : 0;
              const [cx, cz] = rectCenter(t);
              return (
                <group position={[cx, 0, cz]} rotation={[0, yaw, 0]}>
                  <FitBox size={fitSize(M(t.width), M(TABLE_HEIGHT_MM), M(t.height), yaw)}>
                    <StainlessTable />
                  </FitBox>
                </group>
              );
            })()}
            {furniture.premium?.counter && (() => {
              // Balcão premium: costas na parede indicada, banquetas pro salão.
              const { counter, counterWall } = furniture.premium;
              const [cx, cz] = rectCenter(counter);
              const x =
                counterWall === "left" ? M(counter.x) : counterWall === "right" ? M(counter.x + counter.width) : cx;
              const z =
                counterWall === "top" ? M(counter.y) : counterWall === "bottom" ? M(counter.y + counter.height) : cz;
              return (
                <group position={[x, 0, z]} rotation={[0, wallYaw(counterWall), 0]}>
                  <CounterWithStools />
                </group>
              );
            })()}
            {furniture.premium?.pufs && (() => {
              const [cx, cz] = rectCenter(furniture.premium.pufs);
              return (
                <group position={[cx, 0, cz]}>
                  <PoufSet />
                </group>
              );
            })()}
            {furniture.poufs.map((p, i) => {
              // Costas na parede em que as cadeiras encostam, frente pro salão.
              const yaw = wallYaw(furniture.chairsWall);
              const [cx, cz] = rectCenter(p);
              return (
                <group key={i} position={[cx, 0, cz]} rotation={[0, yaw, 0]}>
                  <FitBox size={fitSize(M(p.width), M(CHAIR_HEIGHT_MM), M(p.height), yaw)}>
                    <Chair />
                  </FitBox>
                </group>
              );
            })}
            {(() => {
              // Ar-condicionado na parede indicada pelo motor, virado pra dentro da loja.
              const ac = furniture.ac;
              const yaw = wallYaw(furniture.acWall);
              const [cx, cz] = rectCenter(ac);
              return (
                <group
                  position={[cx, roomH - M(AC_CEILING_GAP_MM + AC_UNIT_HEIGHT_MM), cz]}
                  rotation={[0, yaw, 0]}
                >
                  <FitBox size={fitSize(M(ac.width), M(AC_UNIT_HEIGHT_MM), M(ac.height), yaw)}>
                    <SplitAC />
                  </FitBox>
                </group>
              );
            })()}
          </>
        )}

        {/* Fixos da loja: tapete da entrada, tapete das máquinas (da primeira à
            última, com a logo), dispensers e lixeira embaixo deles */}
        <group position={[fixtures.entranceRug.x, 0.001, fixtures.entranceRug.z]}>
          <Rug width={fixtures.entranceRug.width} depth={fixtures.entranceRug.depth} logo={logo ?? null} />
        </group>
        {fixtures.machineRug && (
          <group position={[fixtures.machineRug.x, 0.001, fixtures.machineRug.z]} rotation={[0, fixtures.machineRug.yaw, 0]}>
            <Rug width={fixtures.machineRug.width} depth={fixtures.machineRug.depth} logo={logo ?? null} />
          </group>
        )}
        {fixtures.dispensers && (
          <group
            position={[fixtures.dispensers.x, DISPENSER_MOUNT_HEIGHT, fixtures.dispensers.z]}
            rotation={[0, fixtures.dispensers.yaw, 0]}
          >
            <Dispensers />
          </group>
        )}
        {fixtures.trash && (
          <group position={[fixtures.trash.x, 0, fixtures.trash.z]}>
            <TrashCan />
          </group>
        )}

        {inauguracao && <Inauguracao layout={layout} />}

        {/* Reflexos para os metais (inox, prata) sem baixar HDR da internet */}
        <Environment resolution={64} environmentIntensity={light.environment}>
          <Lightformer intensity={1.5} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
          <Lightformer intensity={0.8} position={[0, 2, 6]} scale={[10, 3, 1]} />
          <Lightformer intensity={0.5} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        </Environment>

        <CameraRig
          layout={layout}
          tourRun={tourRun}
          orbitPosition={orbitPosition}
          orbitTarget={[roomW / 2, 0, roomD / 2]}
        />
      </Canvas>

      <ul className="plan-legend">
        {[{ label: "Drywall: Verde Escuro Embutido", color: drywallColor }, ...LEGEND].map((item) => (
          <li key={item.label}>
            <span className="plan-legend-swatch" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
