import { useLayoutEffect, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import { StdMat } from "./SharedMaterial";

// Portado de balaoes.html. Arco em espiral de "quartetos" de balões (2 azuis,
// 2 brancos), no plano XY, com os pés no chão e centrado em x = 0. O modelo
// original está em unidades arbitrárias; SCALE leva pra metros (raio do arco
// = 13 * SCALE; altura = isso * HEIGHT_STRETCH).
const SCALE = 0.12;
const RADIUS = 13 * SCALE;
const TUBE_RADIUS = 1.6 * SCALE;
const BALLOON_RADIUS = 1.2 * SCALE;
// Arco esticado na vertical: mais alto que a porta (topo ~2,7 m).
const HEIGHT_STRETCH = 1.6;
const SEGMENTS = 90;
const TWIST = 0.45;

function useBalloonMatrices() {
  const blue = useRef<InstancedMesh>(null);
  const white = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const counts = { blue: 0, white: 0 };
    for (let i = 0; i <= SEGMENTS; i++) {
      const theta = (i / SEGMENTS) * Math.PI;
      const cx = Math.cos(theta) * RADIUS;
      const cy = Math.sin(theta) * RADIUS * HEIGHT_STRETCH;
      for (let j = 0; j < 4; j++) {
        const local = (j * Math.PI) / 2 + i * TWIST;
        dummy.position.set(
          cx + Math.cos(local) * TUBE_RADIUS * Math.cos(theta),
          cy + Math.cos(local) * TUBE_RADIUS * Math.sin(theta),
          Math.sin(local) * TUBE_RADIUS
        );
        dummy.lookAt(cx, cy, 0);
        dummy.scale.set(0.9, 0.9, 1.15);
        dummy.updateMatrix();
        const mesh = j < 2 ? blue.current : white.current;
        const index = j < 2 ? counts.blue++ : counts.white++;
        mesh?.setMatrixAt(index, dummy.matrix);
      }
    }
    for (const mesh of [blue.current, white.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  }, []);

  return { blue, white };
}

export function BalloonArch() {
  const { blue, white } = useBalloonMatrices();
  const perColor = (SEGMENTS + 1) * 2;

  return (
    <group>
      <instancedMesh ref={blue} args={[undefined, undefined, perColor]} castShadow>
        <sphereGeometry args={[BALLOON_RADIUS, 20, 20]} />
        <StdMat color="#1e90ff" roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={white} args={[undefined, undefined, perColor]} castShadow>
        <sphereGeometry args={[BALLOON_RADIUS, 20, 20]} />
        <StdMat color="#ffffff" roughness={0.2} />
      </instancedMesh>
    </group>
  );
}
