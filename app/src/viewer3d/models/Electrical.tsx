import { Vector3 } from "three";
import { SOCKET_BOX_HALF_HEIGHT_MM, type ElectricalLayout, type ElectricalPoint } from "../../engine/electrical";
import type { Layout } from "../../engine/types";
import { drywallFrame, wallYaw } from "../placement";
import { Cable } from "./Cable";
import { Duct } from "./Duct";
import { StdMat } from "./SharedMaterial";

// Elétrica suspensa no 3D (engine/electrical.ts): eletrocalha de alumínio sob
// o forro, perfilado de alumínio descendo por maquinário, tomada Steck
// 2P+T da secadora no meio dele (com o plugue Steck macho da secadora
// ligado) e, embaixo, um conduíte até a caixa vertical de 3 tomadas 220 V
// (lavadora e as 2 bombas dosadoras). Cabos pretos da máquina até as tomadas.
// Tomadas 127 V dos clientes entre as cadeiras.

const M = (mmValue: number) => mmValue / 1000;
const ALUMINUM = { color: "#c5cbd1", metalness: 0.85, roughness: 0.35 };
const CONDUIT = { color: "#1f2937", metalness: 0.2, roughness: 0.6 };
const CORD = { color: "#0b0b0c", metalness: 0.1, roughness: 0.55 }; // cabo de força preto
const STECK_BLUE = "#1d4ed8";

function Rod({ position, length }: { position: Vector3; length: number }) {
  return (
    <mesh position={[position.x, position.y + length / 2, position.z]}>
      <cylinderGeometry args={[0.004, 0.004, length, 8]} />
      <StdMat color="#8b949e" metalness={0.8} roughness={0.4} />
    </mesh>
  );
}

// Plugue 2P+T comum (preto) encaixado numa tomada; o cabo sai por baixo da ponta.
function Plug220() {
  return (
    <group>
      <mesh position={[0, 0, 0.02]} castShadow>
        <boxGeometry args={[0.032, 0.042, 0.04]} />
        <StdMat {...CORD} />
      </mesh>
      <mesh position={[0, 0, 0.042]}>
        <boxGeometry args={[0.026, 0.034, 0.006]} />
        <StdMat color="#27272a" roughness={0.6} />
      </mesh>
    </group>
  );
}

// Plugue industrial Steck 2P+T MACHO da secadora, encaixado na tomada:
// corpo azul com anéis de pega; o cabo sai da ponta de trás.
function SteckPlug() {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.03, 0.08, 20]} />
        <StdMat color={STECK_BLUE} roughness={0.45} />
      </mesh>
      {[0.03, 0.05].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.029, 0.003, 6, 20]} />
          <StdMat color="#1e3a8a" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.01, 0.014, 0.012, 12]} />
        <StdMat {...CORD} />
      </mesh>
    </group>
  );
}

// Tomada 2P+T de embutir (placa branca com 2 furos + terra).
function SocketFace({ x = 0, y = 0, voltageColor }: { x?: number; y?: number; voltageColor: string }) {
  return (
    <group position={[x, y, 0]}>
      <mesh position={[0, 0, 0.0015]}>
        <cylinderGeometry args={[0.019, 0.019, 0.004, 20]} />
        <StdMat color="#f5f5f4" roughness={0.5} />
      </mesh>
      {[-0.006, 0.006].map((dx) => (
        <mesh key={dx} position={[dx, 0.004, 0.004]}>
          <boxGeometry args={[0.003, 0.009, 0.002]} />
          <StdMat color="#111827" />
        </mesh>
      ))}
      <mesh position={[0, -0.008, 0.004]}>
        <cylinderGeometry args={[0.0028, 0.0028, 0.002, 10]} />
        <StdMat color="#111827" />
      </mesh>
      {/* etiqueta de tensão */}
      <mesh position={[0, 0.026, 0.0035]}>
        <boxGeometry args={[0.03, 0.006, 0.001]} />
        <StdMat color={voltageColor} />
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
        <StdMat {...ALUMINUM} />
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
        const boxY = box.length ? (box[0].y + box[box.length - 1].y) / 2 : 0;
        const threePhase = m.dryerSocket.type.includes("3P");
        const boxPos = v({ a: p.a, c: p.c, y: boxY });
        const dryer = v({ a: p.a, c: p.c, y: m.dryerSocket.y });
        const boxH = M(SOCKET_BOX_HALF_HEIGHT_MM * 2);
        const pluggedUses = new Set(m.cords.map((cd) => cd.use).filter(Boolean));
        const hasSteckCord = m.cords.some((cd) => cd.kind === "steck");
        return (
          <group key={i}>
            {/* Perfilado de alumínio (com a fenda voltada pra parede) */}
            <mesh position={center} castShadow>
              <boxGeometry args={frame.size(M(p.sizeMm), len, M(p.sizeMm))} />
              <StdMat {...ALUMINUM} />
            </mesh>
            <group position={center} rotation={[0, towardWall, 0]}>
              <mesh position={[0, 0, half + 0.0006]}>
                <boxGeometry args={[0.012, len * 0.98, 0.001]} />
                <StdMat color="#4b5563" metalness={0.6} roughness={0.5} />
              </mesh>
            </group>

            {/* Tomada Steck: 2P+T da secadora no meio do perfilado, ou 3P+T da máquina trifásica a 1,50 m */}
            <group position={dryer} rotation={[0, towardWall, 0]}>
              <mesh position={[0, 0, half + 0.017]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.032, 0.036, 0.034, 20]} />
                <StdMat color="#1d4ed8" roughness={0.45} />
              </mesh>
              <mesh position={[0, 0, half + 0.0345]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.024, 0.024, 0.002, 20]} />
                <StdMat color="#e5e7eb" roughness={0.4} />
              </mesh>
              {(threePhase ? [-0.012, 0, 0.012] : [-0.01, 0.01]).map((dx) => (
                <mesh key={dx} position={[dx, 0.005, half + 0.0365]}>
                  <boxGeometry args={[0.004, 0.012, 0.002]} />
                  <StdMat color="#111827" />
                </mesh>
              ))}
              <mesh position={[0, -0.012, half + 0.0365]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.004, 0.004, 0.002, 10]} />
                <StdMat color="#111827" />
              </mesh>
              {/* Plugue Steck macho da secadora, ligado */}
              {hasSteckCord && (
                <group position={[0, 0, half + 0.0615]}>
                  <SteckPlug />
                </group>
              )}
            </group>

            {/* Conduíte curto, rente ao perfilado, até a caixa vertical das 3 tomadas 220 V */}
            {box.length > 0 && <Duct points={m.conduit.map(v)} radius={0.011} cornerRadius={0.03} tubular={12} {...CONDUIT} />}
            {box.length > 0 && <group position={boxPos} rotation={[0, towardWall, 0]}>
              <mesh position={[0, 0, half + 0.015]} castShadow>
                <boxGeometry args={[0.075, boxH, 0.03]} />
                <StdMat color="#e5e7eb" roughness={0.5} />
              </mesh>
              <group position={[0, 0, half + 0.03]}>
                {box.map((s, k) => (
                  <group key={k}>
                    <SocketFace y={M(s.y - boxY)} voltageColor="#dc2626" />
                    {/* Plugue ligado só na tomada da máquina (lavadora, embaixo) */}
                    {pluggedUses.has(s.use) && (
                      <group position={[0, M(s.y - boxY), 0]}>
                        <Plug220 />
                      </group>
                    )}
                  </group>
                ))}
              </group>
            </group>}

            {/* Cabos de força pretos, soltos e com folga (laço), como na foto da traseira */}
            {m.cords.map((cd) => (
              <Cable
                key={`${cd.kind}-${cd.use ?? ""}`}
                points={cd.points.map(v)}
                radius={cd.kind === "steck" ? 0.007 : 0.0045}
                options={{ slack: 0.5, maxSag: 0.45, wobble: 0.04 }}
                {...CORD}
              />
            ))}
          </group>
        );
      })}

      {/* Tomadas 127 V dos clientes ENTRE as cadeiras: caixa dupla vertical na
          parede (a 40 cm do piso) ou, sem parede atrás, caixa de piso */}
      {e.customerOutlets.map((o, i) =>
        o.mount === "wall" && o.wall ? (
          <group
            key={`c${i}`}
            position={[M(o.x), M(o.heightMm), M(o.y)]}
            rotation={[0, wallYaw(o.wall), 0]}
          >
            <mesh position={[0, 0, 0.008]} castShadow>
              <boxGeometry args={[0.07, 0.14, 0.016]} />
              <StdMat color="#f5f5f4" roughness={0.5} />
            </mesh>
            {Array.from({ length: o.sockets }, (_, k) => (
              <group key={k} position={[0, (k - (o.sockets - 1) / 2) * 0.06, 0.016]} scale={1.15}>
                <SocketFace voltageColor="#eab308" />
              </group>
            ))}
          </group>
        ) : (
          <group key={`c${i}`} position={[M(o.x), 0, M(o.y)]}>
            <mesh position={[0, 0.006, 0]} receiveShadow>
              <boxGeometry args={[0.1, 0.012, 0.16]} />
              <StdMat color="#9ca3af" metalness={0.7} roughness={0.35} />
            </mesh>
            {Array.from({ length: o.sockets }, (_, k) => (
              <group
                key={k}
                position={[0, 0.012, (k - (o.sockets - 1) / 2) * 0.065]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <SocketFace voltageColor="#eab308" />
              </group>
            ))}
          </group>
        )
      )}
    </group>
  );
}
