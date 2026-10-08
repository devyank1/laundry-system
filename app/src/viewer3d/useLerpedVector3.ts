import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

export function useLerpedVector3(target: [number, number, number], durationMs = 400): Vector3 {
  const current = useRef(new Vector3(...target));
  const from = useRef(new Vector3(...target));
  const to = useRef(new Vector3(...target));
  const elapsed = useRef(durationMs);

  if (to.current.x !== target[0] || to.current.y !== target[1] || to.current.z !== target[2]) {
    from.current.copy(current.current);
    to.current.set(target[0], target[1], target[2]);
    elapsed.current = 0;
  }

  useFrame((_, delta) => {
    if (elapsed.current < durationMs) {
      elapsed.current = Math.min(durationMs, elapsed.current + delta * 1000);
      const t = elapsed.current / durationMs;
      current.current.lerpVectors(from.current, to.current, t);
    }
  });

  return current.current;
}
