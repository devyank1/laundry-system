import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { BufferAttribute, Box3, Matrix4, Mesh, Vector3, type BufferGeometry, type Group, type Material, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Junta as peças paradas que usam o MESMO material numa malha só. A loja tem
// ~800 malhas (parafusos, tubos, pés de cadeira...) e cada uma era uma chamada
// de desenho por quadro; agrupadas viram algumas dezenas.
//
// - As malhas originais continuam na cena, só escondidas (FitBox, sombras e
//   testes enxergam a mesma árvore). A cada render do lote confere se algo
//   mudou (malhas, geometrias, materiais, posições); só então refaz.
// - Fica de fora: o que se mexe sozinho (marcar o grupo com
//   `userData={{ noBatch: true }}`), grupos escondidos (visible=false), malhas
//   instanciadas, multimaterial, transparentes e com cor por vértice.
// - Peça miúda não projeta sombra (mesmo critério de StaticShadows).

export const MIN_SHADOW_CASTER_M = 0.12;
const MERGED = "static-batch";

function batchable(mesh: Mesh): boolean {
  if ((mesh as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh) return false;
  if ((mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) return false;
  const material = mesh.material as Material | Material[];
  if (Array.isArray(material)) return false;
  if (material.transparent || material.vertexColors) return false;
  if (mesh.renderOrder !== 0) return false;
  const geometry = mesh.geometry;
  if (!geometry.attributes.position || Object.keys(geometry.morphAttributes).length > 0) return false;
  return true;
}

// Malhas visíveis dentro de `root`, sem entrar em grupos escondidos ou marcados.
function collect(root: Object3D, out: Mesh[]) {
  for (const child of root.children) {
    if (!child.visible || child.userData.noBatch || child.name === MERGED) continue;
    if ((child as Mesh).isMesh && batchable(child as Mesh)) out.push(child as Mesh);
    collect(child, out);
  }
}

// Só posição/normal/uv, sempre indexada: o mergeGeometries exige atributos iguais.
function normalized(source: BufferGeometry, matrix: Matrix4): BufferGeometry {
  const g = source.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
  }
  g.morphAttributes = {};
  g.clearGroups();
  const count = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute("uv", new BufferAttribute(new Float32Array(count * 2), 2));
  if (!g.index) {
    const index = new (count > 65535 ? Uint32Array : Uint16Array)(count);
    for (let i = 0; i < count; i++) index[i] = i;
    g.setIndex(new BufferAttribute(index, 1));
  }
  g.applyMatrix4(matrix);
  // Peça espelhada (escala negativa, ex.: galão/bomba do outro lado): o three
  // compensa isso por objeto na hora de desenhar; assada na geometria, a ordem
  // dos triângulos fica invertida e a peça aparece do avesso. Desinverte aqui.
  if (matrix.determinant() < 0) {
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
  }
  return g;
}

// Identidade do que entra no lote: igual = nada pra refazer.
function signature(meshes: Mesh[], toRoot: Matrix4): string {
  const m = new Matrix4();
  return meshes
    .map((mesh) => {
      const e = m.multiplyMatrices(toRoot, mesh.matrixWorld).elements;
      const material = mesh.material as Material;
      return `${mesh.id}:${mesh.geometry.id}:${material.uuid}:${+mesh.castShadow}${+mesh.receiveShadow}:${e.map((v) => v.toFixed(4)).join(",")}`;
    })
    .join("|");
}

interface BatchState {
  signature: string;
  hidden: Mesh[];
  merged: Mesh[];
}

function build(root: Group, meshes: Mesh[], toRoot: Matrix4): Pick<BatchState, "hidden" | "merged"> {
  const hidden: Mesh[] = [];
  const merged: Mesh[] = [];
  const box = new Box3();
  const size = new Vector3();
  const buckets = new Map<string, { material: Material; cast: boolean; receive: boolean; items: Mesh[] }>();
  for (const mesh of meshes) {
    const material = mesh.material as Material;
    let cast = mesh.castShadow;
    if (cast) {
      box.setFromObject(mesh).getSize(size);
      cast = Math.max(size.x, size.y, size.z) >= MIN_SHADOW_CASTER_M;
    }
    const key = `${material.uuid}|${cast}|${mesh.receiveShadow}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material, cast, receive: mesh.receiveShadow, items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(mesh);
  }

  for (const { material, cast, receive, items } of buckets.values()) {
    if (items.length < 2) continue;
    const parts = items.map((m) => normalized(m.geometry, new Matrix4().multiplyMatrices(toRoot, m.matrixWorld)));
    const geometry = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!geometry) continue;
    const mesh = new Mesh(geometry, material);
    mesh.name = MERGED;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    root.add(mesh);
    merged.push(mesh);
    for (const m of items) {
      m.visible = false;
      hidden.push(m);
    }
  }
  return { hidden, merged };
}

function release(root: Group, state: BatchState) {
  for (const m of state.merged) {
    root.remove(m);
    m.geometry.dispose();
  }
  for (const m of state.hidden) m.visible = true;
}

export function StaticBatch({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  const state = useRef<BatchState | null>(null);

  // Sem deps de propósito: confere a cada render (layout, cores, fachada...).
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    // Mostra as originais de novo pra enxergar o estado atual da árvore.
    const prev = state.current;
    if (prev) for (const m of prev.hidden) m.visible = true;

    root.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    collect(root, meshes);
    const toRoot = new Matrix4().copy(root.matrixWorld).invert();
    const sig = signature(meshes, toRoot);

    if (prev && prev.signature === sig) {
      for (const m of prev.hidden) m.visible = false;
      return;
    }
    if (prev) release(root, prev);
    state.current = { signature: sig, ...build(root, meshes, toRoot) };
  });

  useEffect(() => {
    const root = ref.current;
    return () => {
      if (root && state.current) release(root, state.current);
      state.current = null;
    };
  }, []);

  return <group ref={ref}>{children}</group>;
}
