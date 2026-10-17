import { Vector3 } from "three";
import type { ElectricalLayout, ElectricalPoint } from "../../engine/electrical";
import type { Layout } from "../../engine/types";
import { drywallFrame, wallYaw } from "../placement";
import { Duct } from "./Duct";

// Elétrica suspensa no 3D (engine/electrical.ts): eletrocalha de alumínio sob
// o forro, perfilado de alumínio descendo por maquinário, tomada Steck
// 2P+T da secadora no meio dele e, na ponta, um conduíte com 2 tomadas 220 V
// (lavadora e bombas dosadoras). Tomadas 127 V dos clientes atrás das cadeiras.

const M = (mmValue: number) => mmValue / 1000;
const ALUMINUM = { color: "#c5cbd1", metalness: 0.85, roughness: 0.35 };
const CONDUIT = { color: "#1f2937", metalness: 0.2, roughness: 0.6 };

function Rod({ position, length }: { position: Vector3; length: number }) {
  return (
    <mesh position={[position.x, position.y + length / 2, position.z]}>
      <cylinderGeometry args={[0.004, 0.004, length, 8]} />
      <meshStandardMaterial color="#8b949e" metalness={0.8} roughness={0.4} />
    </mesh>
  );
}

// Tomada 2P+T de embutir (placa branca com 2 furos + terra).
function SocketFace({ x = 0, voltageColor }: { x?: number; voltageColor: string }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0, 0.0015]}>
        <cylinderGeometry args={[0.019, 0.019, 0.004, 20]} />
        <meshStandardMaterial color="#f5f5f4" roughness={0.5} />
      </mesh>
      {[-0.006, 0.006].map((dx) => (
        <mesh key={dx} position={[dx, 0.004, 0.004]}>
          <boxGeometry args={[0.003, 0.009, 0.002]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
      <mesh position={[0, -0.008, 0.004]}>
        <cylinderGeometry args={[0.0028, 0.0028, 0.002, 10]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* etiqueta de tensão */}
      <mesh position={[0, 0.026, 0.0035]}>
        <boxGeometry args={[0.03, 0.006, 0.001]} />
        <meshStandardMaterial color={voltageColor} />
      </mesh>
    </group>
  );
}

export function Electrical({ layout, electrical: e }: { layout: Layout; electrical: ElectricalLayout }) {
  const frame = drywallFrame(layout);
  const v = (p: ElectricalPoint) => new Vector3(...frame.pos(M(p.a), M(p.y), M(p.c)));

  // Yaw que vira o +z do item pra parede de trás (-c): a frente das tomadas fica pro técnico.
  const origin = new Vector3(...frame.pos(0, 0, 0));
  const cDir = new Vector3(...frame.pos(0, 0, 1)).sub(origin);
  const towardWall = Math.atan2(-cDir.x, -cDir.z);

  const trunkLen = M(Math.abs(e.trunk.to.a - e.trunk.from.a));
  const trunkMid: ElectricalPoint = {
    a: (e.trunk.from.a + e.trunk.to.a) / 2,
    c: e.trunk.from.c,
    y: e.trunk.from.y,
  };
  const ceilingY = M(e.feed.toY);

  return (
    <group>
      {/* Eletrocalha de alumínio sob o forro, com tirantes */}
      <mesh position={v(trunkMid)} castShadow>
        <boxGeometry args={frame.size(trunkLen, M(e.trunk.heightMm), M(e.trunk.widthMm))} />
        <meshStandardMaterial {...ALUMINUM} />
      </mesh>
      {[e.trunk.from.a, e.trunk.to.a, ...e.machines.map((m) => m.profile.a)].map((a, i) => (
        <Rod
          key={i}
          position={v({ a, c: e.trunk.from.c, y: e.trunk.from.y + e.trunk.heightMm / 2 })}
          length={ceilingY - M(e.trunk.from.y + e.trunk.heightMm / 2)}
        />
      ))}
      {/* Descida da alimentação, vinda do forro */}
      <Duct
        points={[v({ a: e.feed.a, c: e.trunk.from.c, y: e.feed.fromY }), v({ a: e.feed.a, c: e.trunk.from.c, y: e.feed.toY })]}
        radius={0.016}
        tubular={2}
        {...CONDUIT}
      />

      {e.machines.map((m, i) => {
        const p = m.profile;
        const len = M(p.topY - p.bottomY);
        const center = v({ a: p.a, c: p.c, y: (p.topY + p.bottomY) / 2 });
        const half = M(p.sizeMm) / 2;
        const box = m.sockets220;
        const boxPos = v({ a: p.a, c: p.c, y: box[0].y });
        const dryer = v({ a: p.a, c: p.c, y: m.dryerSocket.y });
        return (
          <group key={i}>
            {/* Perfilado de alumínio (com a fenda voltada pra parede) */}
            <mesh position={center} castShadow>
              <boxGeometry args={frame.size(M(p.sizeMm), len, M(p.sizeMm))} />
              <meshStandardMaterial {...ALUMINUM} />
            </mesh>
            <group position={center} rotation={[0, towardWall, 0]}>
              <mesh position={[0, 0, half + 0.0006]}>
                <boxGeometry args={[0.012, len * 0.98, 0.001]} />
                <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.5} />
              </mesh>
            </group>

            {/* Tomada industrial Steck 2P+T da secadora, no meio do perfilado */}
            <group position={dryer} rotation={[0, towardWall, 0]}>
              <mesh position={[0, 0, half + 0.017]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.032, 0.036, 0.034, 20]} />
                <meshStandardMaterial color="#1d4ed8" roughness={0.45} />
              </mesh>
              <mesh position={[0, 0, half + 0.0345]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.024, 0.024, 0.002, 20]} />
                <meshStandardMaterial color="#e5e7eb" roughness={0.4} />
              </mesh>
              {[-0.01, 0.01].map((dx) => (
                <mesh key={dx} position={[dx, 0.005, half + 0.0365]}>
                  <boxGeometry args={[0.004, 0.012, 0.002]} />
                  <meshStandardMaterial color="#111827" />
                </mesh>
              ))}
              <mesh position={[0, -0.012, half + 0.0365]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.004, 0.004, 0.002, 10]} />
                <meshStandardMaterial color="#111827" />
              </mesh>
            </group>

            {/* Conduíte curto, rente ao perfilado, até as 2 tomadas 220 V (tudo dentro do comprimento dele) */}
            <Duct points={m.conduit.map(v)} radius={0.011} cornerRadius={0.03} tubular={12} {...CONDUIT} />
            <group position={boxPos} rotation={[0, towardWall, 0]}>
              <mesh position={[0, 0, half + 0.015]} castShadow>
                <boxGeometry args={[0.12, 0.07, 0.03]} />
                <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
              </mesh>
              <group position={[0, 0, half + 0.03]}>
                {box.map((_, k) => (
                  <SocketFace key={k} x={k === 0 ? -0.028 : 0.028} voltageColor="#dc2626" />
                ))}
              </group>
            </group>
          </group>
        );
      })}

      {/* Tomadas 127 V dos clientes, atrás das cadeiras, a 40 cm do piso */}
      {e.customerOutlets.map((o, i) => (
        <group
          key={`c${i}`}
          position={[M(o.x), M(o.heightMm), M(o.y)]}
          rotation={[0, wallYaw(o.wall), 0]}
        >
          <mesh position={[0, 0, 0.008]} castShadow>
            <boxGeometry args={[0.08, 0.08, 0.016]} />
            <meshStandardMaterial color="#f5f5f4" roughness={0.5} />
          </mesh>
          <group position={[0, 0, 0.016]} scale={1.2}>
            <SocketFace voltageColor="#eab308" />
          </group>
        </group>
      ))}
    </group>
  );
}
