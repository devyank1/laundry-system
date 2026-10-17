import { Vector3 } from "three";
import { STANDPIPE_TEE_ARM_MM, type HydraulicPoint, type HydraulicsLayout } from "../../engine/hydraulics";
import type { Layout } from "../../engine/types";
import { drywallFrame } from "../placement";
import { Duct } from "./Duct";
import { DOSING_PORT_LEFT, DOSING_PORT_RIGHT, DOSING_SCALE, DosingPump } from "./DosingPump";
import { JUG_CAP_LOCAL, JUG_SCALE, Jug } from "./Jug";
import { PUMP_INLET_LOCAL, PUMP_OUTLET_LOCAL, PUMP_SCALE, WaterPump } from "./WaterPump";

// Água e esgoto das lavadoras no 3D (ver engine/hydraulics.ts):
//   entrada de água (parede de trás) → pressurizador → barramento →
//   por lavadora: "T" com 2 registros de 3/4";
//   dreno: mangueira → tubo vertical aberto → tubo de esgoto SUSPENSO em
//   suportes (sem ralo nem canal no piso) → parede de trás; respiro até o teto;
//   dosagem: por lavadora, 2 galões no chão e 2 bombas dosadoras coladas na
//   traseira da máquina, logo acima deles.

const M = (mmValue: number) => mmValue / 1000;
const WATER_IN = { color: "#2b5282", metalness: 0.1, roughness: 0.4 }; // entrada (azul-escuro)
const WATER_OUT = { color: "#3182ce", metalness: 0.1, roughness: 0.4 }; // saída/barramento (azul-claro)
const SEWER = { color: "#d9d2c3", metalness: 0.05, roughness: 0.5 };
const PVC_WHITE = { color: "#f1f5f9", metalness: 0.05, roughness: 0.45 };
const TUBE = { color: "#f4f7fa", metalness: 0, roughness: 0.3 }; // silicone das dosadoras
const STEEL = { color: "#9aa5b1", metalness: 0.7, roughness: 0.4 };
const HOSE = { color: "#1f2937", metalness: 0.1, roughness: 0.7 };
const CORNER = 0.1;
const DOSING_INLET_Y_MM = 1350; // entrada de dosagem na traseira da lavadora (estimativa)

function BallValve({ position }: { position: Vector3 }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.024, 14, 10]} />
        <meshStandardMaterial color="#b7a58b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.036, 0]}>
        <boxGeometry args={[0.05, 0.008, 0.014]} />
        <meshStandardMaterial color="#ed8936" roughness={0.5} />
      </mesh>
    </group>
  );
}

export function Hydraulics({ layout, hydraulics: h }: { layout: Layout; hydraulics: HydraulicsLayout }) {
  const frame = drywallFrame(layout);
  const v = (p: HydraulicPoint) => new Vector3(...frame.pos(M(p.a), M(p.y), M(p.c)));
  const L = (a: number, c: number, y: number): HydraulicPoint => ({ a, c, y });

  // Eixos locais (a, c) no mundo — pra converter a posição da saída da bomba de volta pra (a, c).
  const origin = new Vector3(...frame.pos(0, 0, 0));
  const aDir = new Vector3(...frame.pos(1, 0, 0)).sub(origin);
  const cDir = new Vector3(...frame.pos(0, 0, 1)).sub(origin);

  // Bomba virada com a entrada pra parede de trás (-c): o +z do modelo aponta pra -c.
  const yaw = Math.atan2(-cDir.x, -cDir.z);
  const rotate = (p: Vector3) => p.clone().multiplyScalar(PUMP_SCALE).applyAxisAngle(new Vector3(0, 1, 0), yaw);
  const inletTarget = v(h.pump.inlet);
  const pumpPos = inletTarget.clone().sub(rotate(PUMP_INLET_LOCAL));
  const outletWorld = pumpPos.clone().add(rotate(PUMP_OUTLET_LOCAL));
  const rel = outletWorld.clone().sub(inletTarget);
  const outlet = L(
    h.pump.inlet.a + rel.dot(aDir) * 1000,
    h.pump.inlet.c + rel.dot(cDir) * 1000,
    h.pump.inlet.y + rel.y * 1000
  );

  const mainRadius = M(h.manifold.diameterMm) / 2;
  const manY = h.manifold.points[0].y;
  const cMan = h.manifold.points[0].c;
  const aMin = h.manifold.points[1].a;
  const aMax = h.manifold.points[2].a;
  const manifoldLegs = [aMin, aMax]
    .filter((a) => Math.abs(a - outlet.a) > 1)
    .map((a) => [outlet, L(outlet.a, outlet.c, manY), L(outlet.a, cMan, manY), L(a, cMan, manY)].map(v));

  return (
    <group>
      {/* Entrada de água: da rua, pela parede de trás, até o pressurizador */}
      <Duct
        points={[h.waterEntry.outside, h.waterEntry.through, h.pump.inlet].map(v)}
        radius={M(h.waterEntry.diameterMm) / 2}
        {...WATER_IN}
      />
      <group position={pumpPos} rotation={[0, yaw, 0]}>
        <WaterPump />
      </group>

      {/* Saída da bomba → barramento ao longo das máquinas */}
      {manifoldLegs.map((pts, i) => (
        <Duct key={i} points={pts} radius={mainRadius} cornerRadius={CORNER} {...WATER_OUT} />
      ))}

      {/* Por lavadora: derivação de 3/4" → "T" com 2 registros de esfera */}
      {h.washers.map((w, i) => {
        const end = w.branch[1];
        const half = 90; // mm do "T" pra cada lado
        return (
          <group key={`w${i}`}>
            <Duct points={w.branch.map(v)} radius={M(25) / 2} {...WATER_OUT} />
            <Duct points={[L(end.a - half, end.c, end.y), L(end.a + half, end.c, end.y)].map(v)} radius={M(25) / 2} {...WATER_OUT} />
            <BallValve position={v(L(end.a - half, end.c, end.y))} />
            <BallValve position={v(L(end.a + half, end.c, end.y))} />

            {/* Dreno: mangueira com laço → tubo vertical aberto (ladrão) */}
            <Duct points={w.hose.map(v)} radius={0.012} cornerRadius={0.1} {...HOSE} />
            {/* Tubo individual: do tubo central baixo até a ligação em T a 70 cm */}
            <Duct
              points={[L(w.standpipe.a, w.standpipe.c, w.standpipe.baseY), L(w.standpipe.a, w.standpipe.c, w.standpipe.topY)].map(v)}
              radius={M(w.standpipe.diameterMm) / 2}
              tubular={2}
              {...PVC_WHITE}
            />
            <Duct
              points={[
                L(w.standpipe.a - STANDPIPE_TEE_ARM_MM, w.standpipe.c, w.standpipe.topY),
                L(w.standpipe.a + STANDPIPE_TEE_ARM_MM, w.standpipe.c, w.standpipe.topY),
              ].map(v)}
              radius={M(w.standpipe.diameterMm) / 2}
              tubular={2}
              {...PVC_WHITE}
            />
            {/* Respiro do T (braço oposto à mangueira) */}
            <Duct
              points={[
                L(w.standpipe.a - STANDPIPE_TEE_ARM_MM, w.standpipe.c, w.standpipe.topY),
                L(w.standpipe.a - STANDPIPE_TEE_ARM_MM, w.standpipe.c, w.standpipe.topY + 150),
              ].map(v)}
              radius={M(25) / 2}
              tubular={2}
              {...PVC_WHITE}
            />
          </group>
        );
      })}

      {/* Tubo de esgoto suspenso (sem ralo), abaixo das saídas de dreno */}
      {h.drainLine.map((seg, i) => (
        <group key={`d${i}`}>
          <Duct points={seg.points.map(v)} radius={M(seg.diameterMm) / 2} tubular={2} {...SEWER} />
          {/* Luva onde o diâmetro aumenta */}
          {i > 0 && i < h.drainLine.length - 1 && (
            <mesh position={v(seg.points[0])}>
              <sphereGeometry args={[M(seg.diameterMm) / 2 + 0.01, 14, 10]} />
              <meshStandardMaterial color="#c8bfae" roughness={0.5} />
            </mesh>
          )}
        </group>
      ))}
      {/* Suportes: pedestal de aço com abraçadeira sob o tubo (sem tocar o piso do canal) */}
      {h.drainSupports.map((sp, i) => {
        const seg = h.drainLine.find((d) => {
          const [p, q] = d.points;
          const t = (sp.a - p.a) * (q.a - p.a) + (sp.c - p.c) * (q.c - p.c);
          const len2 = (q.a - p.a) ** 2 + (q.c - p.c) ** 2;
          return len2 > 0 && t >= 0 && t <= len2;
        });
        const r = M(seg?.diameterMm ?? 76) / 2;
        const y = M(sp.y);
        const base = v({ ...sp, y: 0 });
        return (
          <group key={`s${i}`} position={base}>
            <mesh position={[0, (y - r) / 2, 0]}>
              <boxGeometry args={[0.02, y - r, 0.02]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
            <mesh position={[0, 0.004, 0]}>
              <boxGeometry args={[0.09, 0.008, 0.09]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
            <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r + 0.004, 0.004, 6, 20]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
          </group>
        );
      })}

      {/* Dosagem: por lavadora, 2 galões no chão + 2 bombas dosadoras na traseira */}
      {h.washers.map((w, i) => {
        const aSign = Math.sign(new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).dot(aDir)) || 1; // +x do modelo → +a ou -a
        const local = (world: Vector3): HydraulicPoint => {
          const d = world.clone().sub(origin);
          return L(d.dot(aDir) * 1000, d.dot(cDir) * 1000, world.y * 1000);
        };
        const R = (p: Vector3, scale: number, mirror: number) =>
          new Vector3(p.x * mirror, p.y, p.z).multiplyScalar(scale).applyAxisAngle(new Vector3(0, 1, 0), yaw);
        return (
          <group key={`ds${i}`}>
            {w.dosing.pumps.map((pump, k) => {
              const inner = pump.a < w.a ? 1 : -1; // direção a (rumo ao centro da máquina)
              const mirror = inner * aSign < 0 ? -1 : 1; // conexão "direita" do modelo sempre do lado de dentro
              const jug = w.dosing.jugs[k];
              const jugMirror = pump.a < w.a ? aSign : -aSign; // tampa do galão do lado de fora
              const pumpCenter = v({ a: pump.a, c: pump.c - 0.55 * DOSING_SCALE * 1000, y: pump.y });
              const jugBase = v({ a: jug.a, c: jug.c, y: 0 });
              const capWorld = jugBase.clone().add(R(JUG_CAP_LOCAL, JUG_SCALE, jugMirror));
              const suction = pumpCenter.clone().add(R(DOSING_PORT_LEFT, DOSING_SCALE, mirror));
              const discharge = pumpCenter.clone().add(R(DOSING_PORT_RIGHT, DOSING_SCALE, mirror));
              const cap = local(capWorld);
              const sIn = local(suction);
              const dIn = local(discharge);
              const gap = w.a - inner * 12; // vão entre as duas bombas (cada recalque no seu lado)
              return (
                <group key={k}>
                  <group position={jugBase} rotation={[0, yaw, 0]} scale={[jugMirror, 1, 1]}>
                    <Jug kind={jug.kind} />
                  </group>
                  <group position={pumpCenter} rotation={[0, yaw, 0]} scale={[mirror, 1, 1]}>
                    <DosingPump />
                  </group>
                  {/* Sucção: tampa do galão → conexão de entrada da bomba */}
                  <Duct
                    points={[cap, L(cap.a, cap.c, sIn.y - 40), L(sIn.a, sIn.c, sIn.y - 40), sIn].map(v)}
                    radius={0.005}
                    cornerRadius={0.02}
                    tubular={16}
                    {...TUBE}
                  />
                  {/* Recalque: conexão de saída → sobe rente à traseira até a entrada de dosagem da máquina */}
                  <Duct
                    points={[
                      dIn,
                      L(dIn.a, dIn.c, dIn.y - 40),
                      L(gap, pump.c - 20, dIn.y - 40),
                      L(gap, pump.c - 20, DOSING_INLET_Y_MM),
                      L(gap, pump.c, DOSING_INLET_Y_MM),
                    ].map(v)}
                    radius={0.005}
                    cornerRadius={0.02}
                    tubular={24}
                    {...TUBE}
                  />
                </group>
              );
            })}
          </group>
        );
      })}

      {/* Saída do esgoto pela parede de trás, também suspensa */}
      <Duct
        points={[
          h.sewerExit.inside,
          h.sewerExit.outside,
        ].map(v)}
        radius={M(h.sewerExit.diameterMm) / 2}
        tubular={2}
        {...SEWER}
      />

      {/* Respiro (ventilação) subindo até perto do teto */}
      {h.vents.map((vent, i) => (
        <Duct
          key={`v${i}`}
          points={[L(vent.a, vent.c, h.drainLine[0].points[0].y), L(vent.a, vent.c, vent.topY)].map(v)}
          radius={M(vent.diameterMm) / 2}
          tubular={2}
          {...PVC_WHITE}
        />
      ))}
    </group>
  );
}
