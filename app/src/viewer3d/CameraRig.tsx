import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Layout } from "../engine/types";
import { customerTourPath, sampleTour, tourDuration } from "./customerTour";

const ORBIT_FOV = 45;
const TOUR_FOV = 60; // mais aberto, como o olho de quem está andando

// Câmera da cena: órbita livre (padrão) ou "visão do cliente". Cada valor
// novo de `tourRun` (re)começa o passeio; null volta pra órbita livre na
// posição inicial. No fim do passeio a órbita volta, mirando nas máquinas,
// pra dar pra olhar em volta. O alvo da órbita é controlado só aqui (não por
// prop), senão cada re-render desfaria a mira do fim do passeio.
export function CameraRig({
  layout,
  tourRun,
  orbitPosition,
  orbitTarget,
}: {
  layout: Layout;
  tourRun: number | null;
  orbitPosition: [number, number, number];
  orbitTarget: [number, number, number];
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  // Câmera e relógio lidos na hora (get), não guardados do render.
  const get = useThree((s) => s.get);
  const path = useMemo(() => customerTourPath(layout), [layout]);
  const tour = useRef<{ start: number } | null>(null);

  useEffect(() => {
    const { camera, clock } = get();
    const setFov = (fov: number) => {
      const cam = camera as PerspectiveCamera;
      cam.fov = fov;
      cam.updateProjectionMatrix();
    };
    const c = controls.current;
    if (tourRun === null) {
      tour.current = null;
      setFov(ORBIT_FOV);
      camera.position.set(...orbitPosition);
      c?.target.set(...orbitTarget);
      if (c) c.enabled = true;
      c?.update();
      return;
    }
    tour.current = { start: clock.getElapsedTime() };
    if (c) c.enabled = false;
    setFov(TOUR_FOV);
    // Só reage a tourRun: mudar o layout no meio não reinicia nem reposiciona.
  }, [tourRun]);

  // Na órbita livre, o alvo acompanha o centro da sala quando ela muda de tamanho.
  const [tx, ty, tz] = orbitTarget;
  useEffect(() => {
    const c = controls.current;
    if (tourRun !== null || !c) return;
    c.target.set(tx, ty, tz);
    c.update();
  }, [tx, ty, tz, tourRun]);

  useFrame(({ camera, clock }) => {
    const t = tour.current;
    if (!t) return;
    const elapsed = clock.getElapsedTime() - t.start;
    const { position, lookAt } = sampleTour(path, elapsed);
    camera.position.set(...position);
    camera.lookAt(...lookAt);
    if (elapsed >= tourDuration(path)) {
      tour.current = null;
      const c = controls.current;
      if (c) {
        c.target.set(...lookAt);
        c.enabled = true;
        c.update();
      }
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.1}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}
