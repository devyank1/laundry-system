import { useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, TubeGeometry, Vector3 } from "three";

// Portado de "Bomba dosadora.html": bomba dosadora peristáltica — carcaça
// azul-escura, cavidade circular com rotor de 4 roletes, tubo de silicone em U
// descendo até 2 conexões pretas na base, tampa transparente com 4 parafusos.
// Origem no centro da carcaça; a frente (tampa transparente) pra +z, as costas
// (coladas na máquina) pra -z. Modelo em unidades arbitrárias; SCALE leva pra
// metros (~13 x 14 cm, 4 cm de profundidade).
export const DOSING_SCALE = 0.04;
// Conexões (entrada/saída) na base, no referencial do modelo.
export const DOSING_PORT_LEFT = new Vector3(-0.8, -2.325, 0.15);
export const DOSING_PORT_RIGHT = new Vector3(0.8, -2.325, 0.15);
export const DOSING_BACK_Z = -0.55; // face traseira da carcaça

function useTubing() {
  return useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(-0.8, -2.0, 0.18),
      new Vector3(-0.8, -0.2, 0.18),
      new Vector3(-0.88, 0.3, 0.18),
      new Vector3(-0.65, 0.9, 0.18),
      new Vector3(0, 1.22, 0.18),
      new Vector3(0.65, 0.9, 0.18),
      new Vector3(0.88, 0.3, 0.18),
      new Vector3(0.8, -0.2, 0.18),
      new Vector3(0.8, -2.0, 0.18),
    ]);
    return new TubeGeometry(curve, 64, 0.14, 20, false);
  }, []);
}

export function DosingPump() {
  const tubing = useTubing();
  const metal = { color: "#cccccc", roughness: 0.25, metalness: 0.2 } as const;
  const dark = { color: "#222222", roughness: 0.3, metalness: 0.5 } as const;

  return (
    <group scale={DOSING_SCALE}>
      {/* Carcaça e cavidade do rotor */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.2, 3.6, 1.1]} />
        <meshStandardMaterial color="#284f78" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.25, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.4, 40]} />
        <meshStandardMaterial color="#1b3652" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Conexões pretas na base */}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, -2.0, 0.15]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.65, 20]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.2} />
        </mesh>
      ))}

      {/* Tubo de silicone em U */}
      <mesh geometry={tubing} castShadow>
        <meshStandardMaterial color="#f4f7fa" roughness={0.25} transparent opacity={0.95} />
      </mesh>

      {/* Rotor: cubo, pino e 4 braços com roletes */}
      <group position={[0, 0.25, 0.25]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 24]} />
          <meshStandardMaterial {...dark} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.3, 12]} />
          <meshStandardMaterial {...metal} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const angle = (i * Math.PI) / 2;
          const arm = 0.82;
          return (
            <group key={i}>
              <mesh
                position={[(arm / 2) * Math.sin(angle), (arm / 2) * Math.cos(angle), 0]}
                rotation={[0, 0, -angle]}
              >
                <boxGeometry args={[0.18, arm, 0.16]} />
                <meshStandardMaterial {...dark} />
              </mesh>
              <mesh position={[arm * Math.sin(angle), arm * Math.cos(angle), 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.13, 0.13, 0.24, 16]} />
                <meshStandardMaterial color="#ededed" roughness={0.2} metalness={0.1} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Tampa transparente e parafusos dos cantos */}
      <mesh position={[0, 0, 0.62]}>
        <boxGeometry args={[3.0, 3.4, 0.12]} />
        <meshPhysicalMaterial color="#ffffff" transmission={0.92} transparent roughness={0.1} ior={1.45} side={DoubleSide} />
      </mesh>
      {([[-1.25, 1.45], [1.25, 1.45], [-1.25, -1.45], [1.25, -1.45]] as const).map(([x, y]) => (
        <mesh key={`${x}${y}`} position={[x, y, 0.68]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.08, 12]} />
          <meshStandardMaterial {...metal} />
        </mesh>
      ))}
    </group>
  );
}
