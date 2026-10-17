import { useEffect, useMemo } from "react";
import {
  CurvePath,
  DoubleSide,
  LineCurve3,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
} from "three";

export const DUCT_COLOR = "#aeb4ba";

// Tubulação em polilinha com cantos arredondados (raio `cornerRadius`),
// usada pela exaustão, água e esgoto. Pontos em metros, no mundo 3D.
export function Duct({
  points,
  radius,
  cornerRadius = 0,
  tubular = 48,
  color = DUCT_COLOR,
  metalness = 0.8,
  roughness = 0.35,
}: {
  points: Vector3[];
  radius: number;
  cornerRadius?: number;
  tubular?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
}) {
  // `points` chega como array novo a cada render; a chave estável evita refazer a malha.
  const key = points.map((p) => p.toArray().join(",")).join("|");
  const geometry = useMemo(() => {
    const path = new CurvePath<Vector3>();
    let cursor = points[0];
    for (let i = 1; i < points.length; i++) {
      const next = points[i];
      const after = points[i + 1];
      if (after && cornerRadius > 0) {
        const lenIn = cursor.distanceTo(next);
        const lenOut = next.distanceTo(after);
        const r = Math.min(cornerRadius, lenIn / 2, lenOut / 2);
        const start = next.clone().sub(cursor).normalize().multiplyScalar(-r).add(next);
        const end = after.clone().sub(next).normalize().multiplyScalar(r).add(next);
        path.add(new LineCurve3(cursor, start));
        path.add(new QuadraticBezierCurve3(start, next, end));
        cursor = end;
      } else {
        path.add(new LineCurve3(cursor, next));
        cursor = next;
      }
    }
    return new TubeGeometry(path, tubular, radius, 16, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, radius, cornerRadius, tubular]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} side={DoubleSide} />
    </mesh>
  );
}

