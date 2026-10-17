import { Vector3 } from "three";
import { Duct } from "./Duct";
import type { ExhaustDuct, ExhaustLayout, ExhaustPoint } from "../../engine/exhaust";
import { WALL_DUCT_CLEARANCE_MM } from "../../engine/exhaust";
import type { Layout } from "../../engine/types";
import { drywallFrame } from "../placement";

// Exaustão das secadoras no 3D: ramais a 45° até o coletor escalonado, que
// sai pela parede de trás da área técnica com o bocal virado pra baixo.
// Duto semirrígido (cinza metálico), tampa de limpeza na ponta fechada e
// manga na parede (folga de 50 mm em volta do duto).

const M = (mmValue: number) => mmValue / 1000;
const CORNER_RADIUS_BRANCH = 0.16;
const CORNER_RADIUS_EXIT = 0.22;

export function Exhaust({ layout, exhaust }: { layout: Layout; exhaust: ExhaustLayout }) {
  const frame = drywallFrame(layout);
  const v = (p: ExhaustPoint) => new Vector3(...frame.pos(M(p.a), M(p.y), M(p.c)));
  const vs = (pts: ExhaustPoint[]) => pts.map(v);

  const collarOf = (d: ExhaustDuct, p: ExhaustPoint) => ({ position: v(p), radius: M(d.diameterMm) / 2 });
  const first = exhaust.collector[0];
  const exitStart = exhaust.exit.points[0];
  const wallInner = { ...exitStart, c: 0 };
  const wallOuter = { ...exitStart, c: -100 };
  const sleeveRadius = M(exhaust.exit.diameterMm / 2 + WALL_DUCT_CLEARANCE_MM);
  const cap = collarOf(first, exhaust.cleaningCap);

  return (
    <group>
      {/* Ramais: saída traseira da secadora → curva longa → 45° → coletor */}
      {exhaust.branches.map((b, i) => (
        <group key={i}>
          <Duct points={vs(b.points)} radius={M(b.diameterMm) / 2} cornerRadius={CORNER_RADIUS_BRANCH} />
          {/* Braçadeira no encaixe da máquina (tubo semirrígido + abraçadeira) */}
          <mesh position={v(b.points[0])}>
            <sphereGeometry args={[M(b.diameterMm) / 2 + 0.012, 16, 12]} />
            <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Coletor escalonado: cada trecho com o diâmetro da estação */}
      {exhaust.collector.map((seg, i) => (
        <group key={i}>
          <Duct points={vs(seg.points)} radius={M(seg.diameterMm) / 2} tubular={4} />
          {i > 0 && (
            <mesh position={v(seg.points[0])} rotation={frame.alongBarRotation}>
              <cylinderGeometry args={[M(seg.diameterMm) / 2 + 0.012, M(seg.diameterMm) / 2 + 0.012, 0.03, 24]} />
              <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.3} />
            </mesh>
          )}
        </group>
      ))}

      {/* Tampa removível de limpeza na ponta fechada */}
      <mesh position={cap.position} rotation={frame.alongBarRotation}>
        <cylinderGeometry args={[cap.radius + 0.02, cap.radius + 0.02, 0.04, 24]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.5} />
      </mesh>

      {/* Saída: canto do coletor → atravessa a parede → bocal pra baixo */}
      <Duct
        points={vs(exhaust.exit.points)}
        radius={M(exhaust.exit.diameterMm) / 2}
        cornerRadius={CORNER_RADIUS_EXIT}
      />

      {/* Manga na parede: folga de 50 mm em volta do duto */}
      <Duct points={[v(wallInner), v(wallOuter)]} radius={sleeveRadius} tubular={2} />
    </group>
  );
}
