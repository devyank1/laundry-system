import { useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import type { Layout } from "../../engine/types";
import { drywallFrame } from "../placement";
import { ElectricalPanel, PANEL_SIZE_M } from "./ElectricalPanel";
import { MODEM_SIZE_M, Modem } from "./Modem";

// QD-01 e modem, como na prancha elétrica (engine/electricalPlan.ts): na
// parede lateral (a cinza) ao lado da porta técnica, dentro da área técnica;
// o modem logo abaixo do quadro, com uma caixa 4x2 de tomada 127 V + ponto
// de rede ao lado, ligados por cabo de força preto e cabo de rede azul.

const M = (mmValue: number) => mmValue / 1000;
const PANEL_CENTER_Y = 1.6; // centro do quadro
const MODEM_GAP = 0.12; // do quadro até a ponta das antenas do modem
const PLATE = { width: 0.075, height: 0.12, depth: 0.012 }; // caixa 4x2 vertical
const PLATE_SIDE_GAP = 0.06;

type V3 = [number, number, number];

function Cable({ points, color, radius }: { points: V3[]; color: string; radius: number }) {
  const geo = useMemo(
    () => new TubeGeometry(new CatmullRomCurve3(points.map((p) => new Vector3(...p))), 24, radius, 6, false),
    [points, radius]
  );
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

// Caixa 4x2: tomada 127 V (2P+T, padrão NBR) em cima e RJ45 embaixo.
function OutletPlate() {
  return (
    <group>
      <mesh position={[0, 0, PLATE.depth / 2]}>
        <boxGeometry args={[PLATE.width, PLATE.height, PLATE.depth]} />
        <meshStandardMaterial color="#f4f4f5" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.03, PLATE.depth + 0.001]}>
        <circleGeometry args={[0.019, 24]} />
        <meshStandardMaterial color="#e4e4e7" roughness={0.5} />
      </mesh>
      {[-0.007, 0.007, 0].map((x, i) => (
        <mesh key={i} position={[x, i === 2 ? 0.039 : 0.026, PLATE.depth + 0.002]}>
          <circleGeometry args={[0.003, 12]} />
          <meshStandardMaterial color="#27272a" />
        </mesh>
      ))}
      <mesh position={[0, -0.03, PLATE.depth + 0.002]}>
        <planeGeometry args={[0.016, 0.013]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
    </group>
  );
}

export function PanelCorner({ layout }: { layout: Layout }) {
  const frame = drywallFrame(layout);
  const { face, mount } = layout.electricalPlan.panel;
  // Referencial da parede no mundo: origem na face dela, normal pro ambiente
  // e eixo lateral (horizontal, ao longo da parede).
  const a0 = M(mount.alongMm);
  // o drywall do 3D vai de drywall.y até drywall.y + espessura: face técnica em drywall.y
  const c0 = face === "drywall" ? M(layout.drywall.y) : M(mount.acrossMm);
  const [na, nc] = face === "side" ? [mount.highEnd ? -1 : 1, 0] : face === "drywall" ? [0, -1] : [0, 1];
  const [ta, tc] = face === "side" ? [0, 1] : [1, 0];
  const base = frame.pos(0, 0, 0);
  const world = (da: number, dc: number): V3 => {
    const p = frame.pos(da, 0, dc);
    return [p[0] - base[0], p[1] - base[1], p[2] - base[2]];
  };
  const n = world(na, nc);
  const t = world(ta, tc);
  const origin = frame.pos(a0, 0, c0);
  const yaw = Math.atan2(n[0], n[2]);
  const at = (lat: number, y: number, depth: number): V3 => [
    origin[0] + t[0] * lat + n[0] * depth,
    y,
    origin[2] + t[2] * lat + n[2] * depth,
  ];

  // Caixa 4x2 do lado oposto à porta técnica: na lateral a porta fica do
  // lado do drywall (+across); no drywall, do lado do corredor.
  const corridor = frame.spatialSpan(layout.techCorridor);
  const awayFromDoor = face === "side" ? -1 : (corridor.start + corridor.end) / 2 > a0 ? -1 : 1;

  const modemTop = PANEL_CENTER_Y - PANEL_SIZE_M.height / 2 - MODEM_GAP;
  const modemY = modemTop - MODEM_SIZE_M.antennaTop;
  const modemBottom = modemY - MODEM_SIZE_M.height / 2;
  const plateY = modemBottom - 0.1;
  const plateLat = awayFromDoor * (MODEM_SIZE_M.width / 2 + PLATE_SIDE_GAP);
  const sideLat = awayFromDoor * (MODEM_SIZE_M.width / 2 - 0.02);

  // Cabos: saem da caixa 4x2 e sobem até a parte de baixo do modem.
  const power: V3[] = [
    at(plateLat, plateY + 0.03, PLATE.depth + 0.01),
    at(plateLat, plateY - 0.04, 0.03),
    at((plateLat + sideLat) / 2, modemBottom - 0.06, 0.03),
    at(sideLat, modemBottom + 0.01, 0.025),
  ];
  const lan: V3[] = [
    at(plateLat, plateY - 0.03, PLATE.depth + 0.01),
    at(plateLat - awayFromDoor * 0.01, plateY - 0.08, 0.025),
    at(plateLat / 2, modemBottom - 0.09, 0.025),
    at(0, modemBottom + 0.01, 0.02),
  ];

  return (
    <group name="panel-corner">
      <group position={at(0, PANEL_CENTER_Y, 0)} rotation={[0, yaw, 0]}>
        <ElectricalPanel />
      </group>
      <group position={at(0, modemY, 0)} rotation={[0, yaw, 0]}>
        <Modem />
      </group>
      <group position={at(plateLat, plateY, 0)} rotation={[0, yaw, 0]}>
        <OutletPlate />
      </group>
      <Cable points={power} color="#111111" radius={0.0035} />
      <Cable points={lan} color="#2563eb" radius={0.003} />
    </group>
  );
}
