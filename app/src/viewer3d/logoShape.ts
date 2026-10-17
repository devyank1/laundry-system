// Transforma a transparência de um PNG em contornos vetoriais, pra extrudar a
// logo em 3D. Tudo puro (sem canvas/three), pra dar pra testar.
//
// Coordenadas de saída: normalizadas na imagem inteira, x ∈ [0, 1] da
// esquerda pra direita e y ∈ [0, 1] de BAIXO pra cima — o mesmo espaço das
// UVs de textura do three.js, então a frente da peça extrudada já sai com as
// cores da logo no lugar certo.

export interface Pt {
  x: number;
  y: number;
}

export interface LogoShape {
  outer: Pt[];
  holes: Pt[][];
}

export interface LogoOutline {
  shapes: LogoShape[];
  // Caixa da parte visível da logo (normalizada), pra ignorar margem transparente.
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface AlphaMask {
  width: number;
  height: number;
  // 1 byte por pixel (0–255), linha a linha, de cima pra baixo.
  alpha: Uint8Array | Uint8ClampedArray;
}

const ALPHA_THRESHOLD = 128;
const SIMPLIFY_EPSILON_PX = 0.3;
const MIN_AREA_PX = 6; // contornos menores que isso são sujeira/serrilhado

// Extrai o canal alfa de um ImageData (RGBA).
export function alphaFromRGBA(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): AlphaMask {
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return { width, height, alpha };
}

export function traceLogo(mask: AlphaMask): LogoOutline | null {
  const { width: w, height: h } = mask;
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && mask.alpha[y * w + x] >= ALPHA_THRESHOLD;

  const loops = marchingSquares(inside, w, h)
    .map((loop) => simplifyClosed(loop, SIMPLIFY_EPSILON_PX))
    .filter((loop) => loop.length >= 3 && Math.abs(signedArea(loop)) >= MIN_AREA_PX);
  if (loops.length === 0) return null;

  // Profundidade de aninhamento: par = forma, ímpar = furo da forma que o contém.
  const depth = loops.map((loop, i) =>
    loops.reduce((n, other, j) => (j !== i && pointInPolygon(loop[0], other) ? n + 1 : n), 0)
  );
  const shapes: { shape: LogoShape; depth: number }[] = [];
  loops.forEach((loop, i) => {
    if (depth[i] % 2 === 0) shapes.push({ shape: { outer: loop, holes: [] }, depth: depth[i] });
  });
  loops.forEach((loop, i) => {
    if (depth[i] % 2 === 0) return;
    // furo vai pra forma imediatamente acima dele (profundidade d-1) que o contém
    const parent = shapes.find(
      (s) => s.depth === depth[i] - 1 && pointInPolygon(loop[0], s.shape.outer)
    );
    parent?.shape.holes.push(loop);
  });

  // Normaliza: x/w, 1 - y/h (y pra cima).
  const norm = (p: Pt): Pt => ({ x: p.x / w, y: 1 - p.y / h });
  const out = shapes.map(({ shape }) => ({
    outer: shape.outer.map(norm),
    holes: shape.holes.map((hole) => hole.map(norm)),
  }));

  const all = out.flatMap((s) => s.outer);
  return {
    shapes: out,
    bbox: {
      minX: Math.min(...all.map((p) => p.x)),
      minY: Math.min(...all.map((p) => p.y)),
      maxX: Math.max(...all.map((p) => p.x)),
      maxY: Math.max(...all.map((p) => p.y)),
    },
  };
}

// Marching squares nos cantos dos pixels: cada amostra (i, j) é o pixel
// (i-1, j-1), com borda de 1 pixel vazio em volta, então todo contorno
// fecha. Pontos ficam no meio das arestas das células (coordenadas em pixel,
// y pra baixo). Devolve laços fechados (sem repetir o primeiro ponto).
function marchingSquares(
  inside: (x: number, y: number) => boolean,
  w: number,
  h: number
): Pt[][] {
  // Pontos guardados em coordenadas "x2" (inteiros: o dobro do espaço de
  // amostras); amostra i fica no centro do pixel i-1, ou seja em i - 0.5.
  const key = (x2: number, y2: number) => `${x2},${y2}`;
  const next = new Map<string, string>();
  const coords = new Map<string, Pt>();

  const sample = (i: number, j: number) => inside(i - 1, j - 1);
  const addSeg = (a: [number, number], b: [number, number]) => {
    const ka = key(a[0], a[1]);
    const kb = key(b[0], b[1]);
    next.set(ka, kb);
    coords.set(ka, { x: a[0] / 2 - 0.5, y: a[1] / 2 - 0.5 });
    coords.set(kb, { x: b[0] / 2 - 0.5, y: b[1] / 2 - 0.5 });
  };

  for (let j = 0; j <= h; j++) {
    for (let i = 0; i <= w; i++) {
      const tl = sample(i, j);
      const tr = sample(i + 1, j);
      const br = sample(i + 1, j + 1);
      const bl = sample(i, j + 1);
      const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (c === 0 || c === 15) continue;
      // pontos médios das arestas, em coords x2
      const top: [number, number] = [2 * i + 1, 2 * j];
      const right: [number, number] = [2 * i + 2, 2 * j + 1];
      const bottom: [number, number] = [2 * i + 1, 2 * j + 2];
      const left: [number, number] = [2 * i, 2 * j + 1];
      // Segmentos orientados com o "dentro" sempre do mesmo lado, pra que cada
      // ponto tenha exatamente um sucessor e os laços se fechem sozinhos.
      switch (c) {
        case 1: addSeg(left, bottom); break;
        case 2: addSeg(bottom, right); break;
        case 3: addSeg(left, right); break;
        case 4: addSeg(right, top); break;
        case 5: addSeg(right, top); addSeg(left, bottom); break; // sela: separa
        case 6: addSeg(bottom, top); break;
        case 7: addSeg(left, top); break;
        case 8: addSeg(top, left); break;
        case 9: addSeg(top, bottom); break;
        case 10: addSeg(top, left); addSeg(bottom, right); break; // sela: separa
        case 11: addSeg(top, right); break;
        case 12: addSeg(right, left); break;
        case 13: addSeg(right, bottom); break;
        case 14: addSeg(bottom, left); break;
      }
    }
  }

  const loops: Pt[][] = [];
  const visited = new Set<string>();
  for (const start of next.keys()) {
    if (visited.has(start)) continue;
    const loop: Pt[] = [];
    let k: string | undefined = start;
    while (k !== undefined && !visited.has(k)) {
      visited.add(k);
      loop.push(coords.get(k)!);
      k = next.get(k);
    }
    if (k === start && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

// Ramer–Douglas–Peucker num laço fechado: divide no ponto mais distante do
// primeiro e simplifica as duas metades.
function simplifyClosed(loop: Pt[], epsilon: number): Pt[] {
  if (loop.length < 4) return loop;
  let far = 0;
  let farDist = -1;
  for (let i = 1; i < loop.length; i++) {
    const d = (loop[i].x - loop[0].x) ** 2 + (loop[i].y - loop[0].y) ** 2;
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const a = rdp(loop.slice(0, far + 1), epsilon);
  const b = rdp([...loop.slice(far), loop[0]], epsilon);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function rdp(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const len = Math.hypot(dx, dy) || 1;
  let index = 0;
  let maxDist = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs(dy * points[i].x - dx * points[i].y + last.x * first.y - last.y * first.x) / len;
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= epsilon) return [first, last];
  const left = rdp(points.slice(0, index + 1), epsilon);
  const right = rdp(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}
