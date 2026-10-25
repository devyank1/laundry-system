import { useMemo } from "react";
import { BoxGeometry, CanvasTexture, DoubleSide, PlaneGeometry, RepeatWrapping } from "three";
import { StdMat } from "./SharedMaterial";

// Portado de cadeira_pl_stica_3d.html. Medidas nativas em metros, origem no
// centro da base. Encosto perfurado (textura com furos via alphaMap), pernas
// afuniladas, assento levemente curvado.

const SEAT_SIZE = 0.42;
const SEAT_Y = 0.45;
const LEG_SPREAD = 0.18;
const BACK_WIDTH = 0.4;
const BACK_HEIGHT = 0.35;
const CHAIR_COLOR = "#5a5c5d";

function useHoleTexture(): CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = "destination-out";
    const radius = 10;
    const spacing = 35;
    for (let y = 20; y < 512; y += spacing) {
      const isEvenRow = Math.floor(y / spacing) % 2 === 0;
      const offsetX = isEvenRow ? 0 : spacing / 2;
      for (let x = 10; x < 512; x += spacing) {
        ctx.beginPath();
        ctx.arc(x + offsetX, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.5, 1.2);
    return texture;
  }, []);
}

function buildSeatGeometryPositions(positions: Float32Array): void {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    let newY = y + (x * x + z * z) * 0.15;
    if (z > 0) newY -= z * 0.1;
    positions[i + 1] = newY;
  }
}

function buildBackGeometryPositions(positions: Float32Array): void {
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    const y = positions[i + 1];
    let z = x * x * 0.3 - y * 0.1;
    if (y < 0) x = x * (1 - Math.abs(y) * 0.2);
    positions[i] = x;
    positions[i + 2] = z;
  }
}

const LEG_POSITIONS: Array<[number, number, number, number]> = [
  [-LEG_SPREAD, LEG_SPREAD, 0.1, 0.1],
  [LEG_SPREAD, LEG_SPREAD, 0.1, -0.1],
  [-LEG_SPREAD, -LEG_SPREAD, -0.1, 0.1],
  [LEG_SPREAD, -LEG_SPREAD, -0.1, -0.1],
];

export function Chair() {
  const holeTexture = useHoleTexture();

  const seatGeometry = useMemo(() => {
    const geo = new BoxGeometry(SEAT_SIZE, 0.02, SEAT_SIZE, 16, 1, 16);
    buildSeatGeometryPositions(geo.attributes.position.array as Float32Array);
    geo.computeVertexNormals();
    return geo;
  }, []);

  const backGeometry = useMemo(() => {
    const geo = new PlaneGeometry(BACK_WIDTH, BACK_HEIGHT, 16, 16);
    buildBackGeometryPositions(geo.attributes.position.array as Float32Array);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      <mesh geometry={seatGeometry} position={[0, SEAT_Y, 0]} castShadow receiveShadow>
        <StdMat color={CHAIR_COLOR} roughness={0.7} metalness={0.1} />
      </mesh>

      {LEG_POSITIONS.map(([x, z, rotX, rotZ], i) => (
        <mesh
          key={i}
          position={[x, 0.23, z]}
          rotation={[rotX, 0, rotZ]}
          castShadow
        >
          <cylinderGeometry args={[0.015, 0.008, 0.46, 16]} />
          <StdMat color={CHAIR_COLOR} roughness={0.7} metalness={0.1} />
        </mesh>
      ))}

      <mesh position={[-0.18, 0.58, -0.22]} rotation={[-0.2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.02, 0.25, 16]} />
        <StdMat color={CHAIR_COLOR} roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0.18, 0.58, -0.22]} rotation={[-0.2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.02, 0.25, 16]} />
        <StdMat color={CHAIR_COLOR} roughness={0.7} metalness={0.1} />
      </mesh>

      <mesh geometry={backGeometry} position={[0, 0.75, -0.25]} rotation={[-0.15, 0, 0]} castShadow>
        <StdMat
          color={CHAIR_COLOR}
          roughness={0.7}
          metalness={0.1}
          alphaMap={holeTexture}
          alphaTest={0.5}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
