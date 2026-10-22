// Caminho de cabo/tubinho flexível (fio de força, mangueirinha de dosagem):
// como na foto da traseira das máquinas (img/fundo-maq.jpeg), o fio é bem mais
// comprido que a distância entre as pontas e fica pendurado, fazendo barriga.
// Em cada trecho com vão na horizontal o meio cai proporcional ao comprimento
// (folga) e ondula um pouco pro lado. As pontas (plugue, conexão) ficam
// exatamente onde estavam. Metros, no mundo 3D (y pra cima).

export type Vec3 = [number, number, number];

export interface CableOptions {
  slack?: number; // quanto o meio cai, como fração do comprimento do trecho
  maxSag?: number;
  wobble?: number; // desvio lateral no meio dos trechos
  minY?: number; // nunca abaixo disso (raio do cabo acima do piso)
}

const DEFAULTS: Required<CableOptions> = { slack: 0.3, maxSag: 0.5, wobble: 0.03, minY: 0.006 };
const SAMPLES = [0.15, 0.3, 0.5, 0.7, 0.85];

export function cablePoints(points: Vec3[], options: CableOptions = {}): Vec3[] {
  const { slack, maxSag, wobble, minY } = { ...DEFAULTS, ...options };
  if (points.length < 2) return points;
  const out: Vec3[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    const dx = bx - ax;
    const dz = bz - az;
    const horizontal = Math.hypot(dx, dz);
    const length = Math.hypot(dx, by - ay, dz);
    // Trecho puramente vertical: só segue (sem vão, não tem como pender).
    if (length > 1e-6 && horizontal > 1e-6) {
      const sag = Math.min(maxSag, length * slack);
      // desvio lateral com sinal alternado por trecho (determinístico)
      const side = (i % 2 === 0 ? 1 : -1) * Math.min(wobble, horizontal * 0.15);
      const [px, pz] = [-dz / horizontal, dx / horizontal];
      for (const t of SAMPLES) {
        const bow = 4 * t * (1 - t); // parábola: 0 nas pontas, 1 no meio
        out.push([
          ax + dx * t + px * side * bow,
          Math.max(minY, ay + (by - ay) * t - sag * bow),
          az + dz * t + pz * side * bow,
        ]);
      }
    }
    out.push(points[i]);
  }
  return out;
}
