import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Mesh } from "three";
import { useLerpedVector3 } from "./useLerpedVector3";
import { TOTEM_SIZE_MM } from "../engine/constants";
import type { Layout, PlacedMachine } from "../engine/types";

const M = (mmValue: number) => mmValue / 1000;

function MachineMesh({ catalogId, instanceIndex, x, widthMm, depthMm, heightMm }: PlacedMachine) {
  const w = M(widthMm);
  const d = M(depthMm);
  const h = M(heightMm);
  const targetPosition = useLerpedVector3([M(x) + w / 2, h / 2, d / 2]);
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    meshRef.current?.position.copy(targetPosition);
  });

  return (
    <mesh ref={meshRef} position={targetPosition} castShadow key={`${catalogId}-${instanceIndex}`}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color="#9fb8d9" />
    </mesh>
  );
}

export function Scene({
  layout,
  onCanvasReady,
}: {
  layout: Layout;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}) {
  const roomW = M(layout.roomWidthMm);
  const roomD = M(layout.roomDepthMm);
  const roomH = M(layout.ceilingHeightMm);

  return (
    <Canvas
      gl={{ preserveDrawingBuffer: true }}
      camera={{ position: [roomW, roomH * 1.5, roomD * 1.5], fov: 50 }}
      onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[roomW, roomH * 2, roomD]} intensity={0.8} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomW / 2, 0, roomD / 2]} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>

      {layout.machines.map((machine) => (
        <MachineMesh key={`${machine.catalogId}-${machine.instanceIndex}`} {...machine} />
      ))}

      {layout.furniture && (
        <mesh
          position={[
            M(layout.furniture.totem.x) + M(layout.furniture.totem.width) / 2,
            M(TOTEM_SIZE_MM.height) / 2,
            M(layout.furniture.totem.y) + M(layout.furniture.totem.height) / 2,
          ]}
        >
          <boxGeometry
            args={[M(layout.furniture.totem.width), M(TOTEM_SIZE_MM.height), M(layout.furniture.totem.height)]}
          />
          <meshStandardMaterial color="#333333" />
        </mesh>
      )}

      <OrbitControls enableDamping dampingFactor={0.1} />
    </Canvas>
  );
}
