import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import { cablePoints, type CableOptions } from "../cablePath";
import { StdMat } from "./SharedMaterial";

// Cabo/tubinho flexível (fio de força, mangueirinha das dosadoras): curva
// suave passando pela rota, com barriga e leve ondulação (ver cablePath.ts),
// em vez da polilinha reta do Duct.
export function Cable({
  points,
  radius,
  color,
  metalness = 0.1,
  roughness = 0.6,
  options,
}: {
  points: Vector3[];
  radius: number;
  color: string;
  metalness?: number;
  roughness?: number;
  options?: CableOptions;
}) {
  const key = points.map((p) => p.toArray().join(",")).join("|");
  const geometry = useMemo(() => {
    const pts = cablePoints(
      points.map((p) => p.toArray() as [number, number, number]),
      { minY: radius, ...options }
    ).map((p) => new Vector3(...p));
    const curve = new CatmullRomCurve3(pts, false, "centripetal");
    return new TubeGeometry(curve, Math.max(32, pts.length * 8), radius, 10, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow>
      <StdMat color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}
