import { Vector3 } from "three";
import type { HydraulicPoint, HydraulicsLayout } from "../../engine/hydraulics";
import type { Layout } from "../../engine/types";
import { drywallFrame } from "../placement";
import { Cable } from "./Cable";
import { Duct } from "./Duct";
import { DOSING_PORT_LEFT, DOSING_PORT_RIGHT, DOSING_SCALE, DosingPump } from "./DosingPump";
import { JUG_CAP_LOCAL, JUG_SCALE, Jug } from "./Jug";
import { PUMP_INLET_LOCAL, PUMP_OUTLET_LOCAL, PUMP_SCALE, WaterPump } from "./WaterPump";
import { StdMat } from "./SharedMaterial";

// Água e esgoto das lavadoras no 3D (ver engine/hydraulics.ts):
//   entrada de água (parede de trás) → pressurizador → barramento no piso →
//   por lavadora: tubo subindo do chão com registro no meio → "T" a 70 cm →
//   2 mangueiras até a máquina;
//   dreno: mangueira → tubo vertical RETO e aberto → tubo de esgoto SUSPENSO
//   em suportes → parede de trás; respiro até o teto; ralinho no piso;
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
const ELBOW = { color: "#2563eb", metalness: 0.1, roughness: 0.45 }; // cotovelo de 90° (PPR azul)
const BRAIDED = { color: "#b8bfc7", metalness: 0.8, roughness: 0.35 }; // mangueira de água trançada
const ELBOW_ARM_MM = 45; // braço de cada lado do cotovelo de 90° na base do tubo que sobe

// Registro de esfera no tubo vertical: corpo bege com porcas sextavadas nas
// pontas e alavanca de aço saindo do meio da esfera, com empunhadura laranja,
// apontando pra trás (rumo à parede, pro lado oposto das máquinas).
const BRASS = { color: "#b7a58b", metalness: 0.4, roughness: 0.45 };
const LEVER_STEEL = { color: "#9aa5b1", metalness: 0.8, roughness: 0.35 };
const LEVER_GRIP = { color: "#ed8936", metalness: 0.1, roughness: 0.55 };

function BallValve({ position, forward }: { position: Vector3; forward: Vector3 }) {
  const yaw = Math.atan2(forward.x, forward.z);
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Corpo esférico e porcas sextavadas (uniões) acima e abaixo */}
      <mesh>
        <sphereGeometry args={[0.022, 16, 12]} />
        <StdMat {...BRASS} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[0, k * 0.03, 0]}>
          <cylinderGeometry args={[0.019, 0.019, 0.016, 6]} />
          <StdMat {...BRASS} />
        </mesh>
      ))}
      {/* Alavanca saindo do meio da esfera, pra trás */}
      <mesh position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.024, 10]} />
        <StdMat {...LEVER_STEEL} />
      </mesh>
      <mesh position={[0, 0, -0.045]}>
        <boxGeometry args={[0.004, 0.014, 0.06]} />
        <StdMat {...LEVER_STEEL} />
      </mesh>
      {/* Empunhadura de vinil laranja na ponta da alavanca */}
      <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0085, 0.0085, 0.04, 12]} />
        <StdMat {...LEVER_GRIP} />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <sphereGeometry args={[0.0085, 12, 8]} />
        <StdMat {...LEVER_GRIP} />
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
  // Extensão total do barramento (inclui a saída da bomba): só nas pontas ele dobra em cotovelo.
  const lo = Math.min(aMin, outlet.a);
  const hi = Math.max(aMax, outlet.a);
  // Sai da bomba pro lado das máquinas, desce até o piso e corre ao longo da fileira.
  const manifoldLegs = [aMin, aMax]
    .filter((a) => Math.abs(a - outlet.a) > 1)
    .map((a) => [outlet, L(outlet.a, cMan, outlet.y), L(outlet.a, cMan, manY), L(a, cMan, manY)].map(v));

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
        <Duct key={i} points={pts} radius={mainRadius} cornerRadius={0.1} {...WATER_OUT} />
      ))}

      {/* Por lavadora: tubo sobe do barramento no piso (registro no meio) até o
          "T" na altura dos galões; cotovelo de 90° em cada ponta, virado pra
          máquina, e mangueira trançada quase reta até as entradas lado a lado */}
      {h.washers.map((w, i) => {
        const [t0, t1] = w.water.tee;
        const top = w.water.riser[1];
        return (
          <group key={`w${i}`}>
            <Duct points={w.water.riser.map(v)} radius={M(25) / 2} tubular={2} {...WATER_OUT} />
            <BallValve position={v(w.water.valve)} forward={cDir} />
            {/* Base do tubo que sobe: na ponta do barramento um cotovelo de 90° fechado
                (braço horizontal + vertical, canto arredondado); no meio, um T */}
            {(() => {
              const base = w.water.riser[0];
              const atEnd = base.a <= lo + 1 || base.a >= hi - 1;
              const radius = mainRadius + 0.002;
              if (!atEnd) {
                return (
                  <mesh position={v(base)}>
                    <sphereGeometry args={[radius, 18, 14]} />
                    <StdMat {...ELBOW} />
                  </mesh>
                );
              }
              const toward = base.a <= lo + 1 ? 1 : -1; // o resto do barramento fica deste lado
              return (
                <Duct
                  points={[
                    L(base.a + toward * ELBOW_ARM_MM, base.c, base.y),
                    base,
                    L(base.a, base.c, base.y + ELBOW_ARM_MM),
                  ].map(v)}
                  radius={radius}
                  cornerRadius={0.025}
                  tubular={16}
                  {...ELBOW}
                />
              );
            })()}
            <Duct points={[t0, t1].map(v)} radius={M(25) / 2} tubular={2} {...WATER_OUT} />
            <mesh position={v(top)}>
              <sphereGeometry args={[M(25) / 2 + 0.006, 14, 10]} />
              <StdMat {...WATER_OUT} />
            </mesh>
            {/* Cotovelos de 90° (azuis, como na foto) nas pontas do T */}
            {w.water.tee.map((t, k) => {
              const e = w.water.elbows[k];
              const back = L(t.a + (k === 0 ? 30 : -30), t.c, t.y); // entra pelo braço do T
              return (
                <Duct
                  key={`e${k}`}
                  points={[back, t, e].map(v)}
                  radius={M(25) / 2 + 0.004}
                  cornerRadius={0.025}
                  tubular={16}
                  {...ELBOW}
                />
              );
            })}
            {/* Mangueiras trançadas: do cotovelo lá embaixo, sobem colada na
                máquina até as entradas lado a lado, perto das dosadoras */}
            {w.water.hoses.map((hose, k) => (
              <Cable key={k} points={hose.map(v)} radius={0.008} options={{ slack: 0.04, maxSag: 0.04, wobble: 0.02 }} {...BRAIDED} />
            ))}
            {/* Entradas de água (latão) na traseira da máquina */}
            {w.water.inlets.map((p, k) => (
              <group key={`in${k}`} position={v(p)} rotation={[0, yaw, 0]}>
                <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.024, 6]} />
                  <StdMat color="#c9a227" metalness={0.8} roughness={0.35} />
                </mesh>
              </group>
            ))}

            {/* Dreno: mangueira com laço → desce dentro do tubo vertical */}
            <Duct points={w.hose.map(v)} radius={0.012} cornerRadius={0.1} {...HOSE} />
            {/* Tubo individual RETO: do tubo central baixo até a boca aberta a 70 cm */}
            <Duct
              points={[L(w.standpipe.a, w.standpipe.c, w.standpipe.baseY), L(w.standpipe.a, w.standpipe.c, w.standpipe.topY)].map(v)}
              radius={M(w.standpipe.diameterMm) / 2}
              tubular={2}
              {...PVC_WHITE}
            />
            <mesh position={v(L(w.standpipe.a, w.standpipe.c, w.standpipe.topY))}>
              <torusGeometry args={[M(w.standpipe.diameterMm) / 2, 0.004, 8, 24]} />
              <StdMat {...PVC_WHITE} />
            </mesh>
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
              <StdMat color="#c8bfae" roughness={0.5} />
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
              <StdMat {...STEEL} />
            </mesh>
            <mesh position={[0, 0.004, 0]}>
              <boxGeometry args={[0.09, 0.008, 0.09]} />
              <StdMat {...STEEL} />
            </mesh>
            <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r + 0.004, 0.004, 6, 20]} />
              <StdMat {...STEEL} />
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
              const inlet = w.dosing.inlets[k];
              return (
                <group key={k}>
                  <group position={jugBase} rotation={[0, yaw, 0]} scale={[jugMirror, 1, 1]}>
                    <Jug kind={jug.kind} />
                  </group>
                  <group position={pumpCenter} rotation={[0, yaw, 0]} scale={[mirror, 1, 1]}>
                    <DosingPump />
                  </group>
                  {/* Sucção: mangueirinha solta, direto da tampa do galão à entrada da bomba */}
                  <Cable
                    points={[cap, sIn].map(v)}
                    radius={0.0045}
                    options={{ slack: 0.3, maxSag: 0.3, wobble: 0.03 }}
                    {...TUBE}
                  />
                  {/* Recalque: tubinho solto, com barriga grande, da saída da bomba
                      até a entrada de dosagem ao lado (cruza com o da outra bomba) */}
                  <Cable
                    points={[dIn, L(inlet.a, inlet.c - 8, inlet.y)].map(v)}
                    radius={0.005}
                    options={{ slack: 0.8, maxSag: 0.32, wobble: 0.03 }}
                    {...TUBE}
                  />
                  {/* Entrada de dosagem: furo com anel preto na traseira */}
                  <group position={v(inlet)} rotation={[0, yaw, 0]}>
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.014, 0.014, 0.012, 16]} />
                      <StdMat color="#111827" roughness={0.6} />
                    </mesh>
                  </group>
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

      {/* Ralinho no piso da área técnica, junto da parede de trás */}
      <group position={v(L(h.floorDrain.a, h.floorDrain.c, 2))}>
        <mesh>
          <boxGeometry args={[M(h.floorDrain.sizeMm), 0.004, M(h.floorDrain.sizeMm)]} />
          <StdMat {...STEEL} />
        </mesh>
        {[-2, -1, 0, 1, 2].map((k) => (
          <mesh key={k} position={[k * M(h.floorDrain.sizeMm) * 0.16, 0.0025, 0]}>
            <boxGeometry args={[0.006, 0.002, M(h.floorDrain.sizeMm) * 0.75]} />
            <StdMat color="#1f2937" />
          </mesh>
        ))}
      </group>

    </group>
  );
}
