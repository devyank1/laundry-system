import {
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshBasicMaterialParameters,
  type MeshStandardMaterialParameters,
} from "three";

// Materiais compartilhados. O JSX do R3F cria UM material novo por <mesh>;
// com ~800 malhas na loja, o three recalcula parâmetros/chave de programa e
// confere o link de shader pra cada uma (segundos de travada ao abrir o 3D).
// Aqui, materiais com as mesmas propriedades viram a MESMA instância, então
// o custo passa a ser pelo número de materiais distintos (dezenas).

type Extra = { attach?: string };

const cache = new Map<string, Material>();
const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;

function idOf(value: object): number {
  let id = objectIds.get(value);
  if (id === undefined) {
    id = nextObjectId++;
    objectIds.set(value, id);
  }
  return id;
}

function keyOf(kind: string, props: Record<string, unknown>): string {
  const parts = Object.keys(props)
    .sort()
    .map((k) => {
      const v = props[k];
      if (v !== null && typeof v === "object") return `${k}=#${idOf(v)}`; // textura, etc.
      return `${k}=${String(v)}`;
    });
  return `${kind}|${parts.join("|")}`;
}

function shared<T extends Material>(kind: string, props: Record<string, unknown>, make: () => T): T {
  const key = keyOf(kind, props);
  let material = cache.get(key);
  if (!material) {
    material = make();
    cache.set(key, material);
  }
  return material as T;
}

function Shared({ material, attach }: { material: Material; attach?: string }) {
  return <primitive object={material} attach={attach ?? "material"} dispose={null} />;
}

export function StdMat({ attach, ...props }: MeshStandardMaterialParameters & Extra) {
  return (
    <Shared
      attach={attach}
      material={shared("std", props, () => new MeshStandardMaterial(props))}
    />
  );
}

export function BasicMat({ attach, ...props }: MeshBasicMaterialParameters & Extra) {
  return (
    <Shared
      attach={attach}
      material={shared("basic", props, () => new MeshBasicMaterial(props))}
    />
  );
}
