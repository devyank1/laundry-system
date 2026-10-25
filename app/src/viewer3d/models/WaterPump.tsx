import { useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, TubeGeometry, Vector3 } from "three";
import { BasicMat, StdMat } from "./SharedMaterial";

// Portado de gemini-code-*.html ("Bomba Hidráulica Pressurizadora"): base
// preta com 4 pés, motor aletado, voluta cinza-escura com manômetro, tanque de
// pressão branco com faixa da marca e etiqueta, caixa de ligações e fiação
// amarela. Sem as tubulações longas do modelo: a água entra e sai pelos canos
// da instalação (Hydraulics.tsx), que se ligam nas portas abaixo.
// Modelo em unidades arbitrárias; PUMP_SCALE leva pra metros (~0,29 m de base,
// ~0,56 m de altura). Frente (conexão de entrada) pra +z.
export const PUMP_SCALE = 0.12;
// Portas (no referencial do modelo, antes da escala): entrada na frente (+z),
// saída pra cima (+y), no topo do flange traseiro.
export const PUMP_INLET_LOCAL = new Vector3(0.3, 1.25, 1.3);
export const PUMP_OUTLET_LOCAL = new Vector3(0.8, 2.45, -0.3);

const LIGHT_GREY = { color: "#e6e6e6", roughness: 0.25 } as const;
const DARK_GREY = { color: "#3d3d3d", roughness: 0.5, metalness: 0.4 } as const;
const BLACK = { color: "#1e1e1e", roughness: 0.7 } as const;
const METAL = { color: "#999999", metalness: 0.8, roughness: 0.2 } as const;

function Mat(props: { color: string; roughness?: number; metalness?: number }) {
  return <StdMat {...props} />;
}

function useWire() {
  return useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(-1.1, 0.9, 0.6),
      new Vector3(-1.0, 0.5, 0.7),
      new Vector3(-0.5, 0.4, 0.9),
      new Vector3(0.3, 0.4, 0.9),
      new Vector3(0.8, 0.5, 0.5),
      new Vector3(0.6, 0.8, 0.1),
    ]);
    return new TubeGeometry(curve, 30, 0.04, 8, false);
  }, []);
}

export function WaterPump() {
  const wire = useWire();

  return (
    <group scale={PUMP_SCALE}>
      {/* 1. Base preta com pés e parafusos */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.2, 2.4]} />
        <Mat {...BLACK} />
      </mesh>
      {([-1.1, 1.1] as const).flatMap((x) =>
        ([-1.1, 1.1] as const).map((z) => (
          <group key={`${x}${z}`}>
            <mesh position={[x, 0.2, z]}>
              <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
              <Mat {...BLACK} />
            </mesh>
            <mesh position={[x, 0.32, z]}>
              <cylinderGeometry args={[0.06, 0.06, 0.08, 6]} />
              <Mat {...METAL} />
            </mesh>
          </group>
        ))
      )}

      {/* 2. Tanque de pressão */}
      <group position={[-0.3, 3.2, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.85, 0.85, 1.2, 32]} />
          <Mat {...LIGHT_GREY} />
        </mesh>
        <mesh position={[0, 0.6, 0]} castShadow>
          <sphereGeometry args={[0.85, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat {...LIGHT_GREY} />
        </mesh>
        <mesh position={[0, -0.6, 0]} castShadow>
          <sphereGeometry args={[0.85, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <Mat {...LIGHT_GREY} />
        </mesh>
        <mesh position={[0, 1.48, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.1, 16]} />
          <Mat {...BLACK} />
        </mesh>
        <mesh position={[0, -1.2, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.45, 0.5, 16]} />
          <Mat {...LIGHT_GREY} />
        </mesh>
        {/* Faixa da marca e etiqueta de especificações */}
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.86, 0.86, 0.35, 32]} />
          <BasicMat color="#222222" />
        </mesh>
        <mesh position={[0, -0.2, 0]} rotation={[0, -Math.PI / 1.5, 0]}>
          <cylinderGeometry args={[0.86, 0.86, 0.3, 32, 1, true, 0, Math.PI]} />
          <BasicMat color="#d4af37" side={DoubleSide} />
        </mesh>
      </group>

      {/* 3. Motor com aletas */}
      <group position={[-0.3, 1.0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.7, 0.7, 1.4, 24]} />
          <Mat {...BLACK} />
        </mesh>
        {[-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.72, 0.02, 8, 24]} />
            <Mat {...BLACK} />
          </mesh>
        ))}
      </group>

      {/* 4. Voluta e cabeça da bomba, manômetro, flange traseiro e entrada */}
      <group position={[0.4, 1.3, 0.2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.65, 0.65, 1.8, 16]} />
          <Mat {...DARK_GREY} />
        </mesh>
        <mesh position={[-0.1, 0.7, -0.3]} castShadow>
          <boxGeometry args={[0.9, 0.8, 0.9]} />
          <Mat {...DARK_GREY} />
        </mesh>
        <group position={[-0.4, 1.25, -0.3]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
            <Mat {...DARK_GREY} />
          </mesh>
          <mesh position={[-0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.03, 16]} />
            <Mat {...LIGHT_GREY} />
          </mesh>
          <mesh position={[-0.07, 0.04, 0]} rotation={[-Math.PI / 6, 0, 0]}>
            <boxGeometry args={[0.015, 0.14, 0.015]} />
            <Mat {...BLACK} />
          </mesh>
        </group>
        <mesh position={[0.4, 0.5, -0.5]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 1.3, 16]} />
          <Mat {...DARK_GREY} />
        </mesh>
        <mesh position={[0.4, 1.15, -0.5]}>
          <cylinderGeometry args={[0.45, 0.45, 0.15, 16]} />
          <Mat {...DARK_GREY} />
        </mesh>
        {/* Conexão de entrada (flange com rosca) */}
        <group position={[-0.1, 0.2, 0.8]} rotation={[Math.PI / 6, 0, 0]}>
          <mesh rotation={[0, 0, -Math.PI / 6]} castShadow>
            <boxGeometry args={[0.8, 0.4, 0.4]} />
            <Mat {...DARK_GREY} />
          </mesh>
          <mesh position={[0, 0, 0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.4, 24]} />
            <Mat {...METAL} />
          </mesh>
          <mesh position={[0, 0, 0.45]}>
            <torusGeometry args={[0.32, 0.04, 8, 24]} />
            <Mat {...METAL} />
          </mesh>
        </group>
      </group>

      {/* 5. Caixa de ligações e fiação */}
      <mesh position={[-1.1, 1.4, 0.6]} rotation={[0, Math.PI / 6, Math.PI / 18]} castShadow>
        <boxGeometry args={[0.5, 0.8, 0.8]} />
        <StdMat color="#151515" roughness={0.4} />
      </mesh>
      <mesh geometry={wire} castShadow>
        <StdMat color="#dca83a" roughness={0.6} />
      </mesh>
    </group>
  );
}
