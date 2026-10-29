import { CEILING_CLEARANCE_MM, machineBaseMm } from "./constants";
import type { CatalogMachine } from "./types";

// Exaustão das secadoras (manual Évora "Stack Elétrica" + resumo SSU/SSG +
// fichas Mamute). Tudo em mm no referencial LOCAL da fileira:
//   a = ao longo da parede das máquinas, c = da parede de trás da área técnica
//   (c = 0, face interna) em direção ao salão, y = altura do piso.
// Cada secadora tem um ramal que sobe a 45° e entra no coletor a favor do
// fluxo; o coletor corre atrás das máquinas, cresce de diâmetro a cada
// secadora e sai pela parede de trás (a "parte de cima" da planta), com o
// bocal virado pra baixo, do lado oposto à porta técnica.

// Diâmetro mínimo do coletor por estação de dutos (A..K = 1ª..11ª secadora a
// partir da ponta fechada). Ebook Stack, "Medidas duto coletor compartilhado".
export const COLLECTOR_STATIONS_MM = [102, 203, 229, 254, 279, 305, 326, 356, 381, 381, 406];

export const DEFAULT_EXHAUST_DIAMETER_MM = 102; // 4" — duto no encaixe da secadora
export const MAX_LENGTH_SHARED_MM = 9100; // coletor compartilhado (Ebook Stack)
export const MAX_LENGTH_SINGLE_MM = 4300; // instalação simples, duto rígido (SSU/SSG)
export const MIN_TERMINATION_CLEARANCE_MM = 910; // bocal a 91 cm do piso/teto/barreira
export const WALL_DUCT_CLEARANCE_MM = 50; // folga em volta do duto ao atravessar a parede
export const WALL_THICKNESS_MM = 100; // parede de trás da sala

const PORT_BELOW_TOP_MM = 300; // sem altura da saída no catálogo: topo da máquina - 30 cm
const STUB_MIN_MM = 100; // reto saindo da máquina antes da curva
const RAMP_MIN_MM = 300; // avanço do ramal a 45° até o coletor
const COLLECTOR_RISE_MM = 300; // coletor acima da saída mais alta
const CEILING_GAP_MM = 100; // folga do coletor até o teto
const EXIT_END_MARGIN_MM = 250; // saída no meio da faixa lateral de 50cm
const OUTSIDE_RUN_MM = 300; // do lado de fora, antes de virar pra baixo
const DROP_MM = 300; // descida do bocal

export interface ExhaustPoint {
  a: number;
  c: number;
  y: number;
}

export interface ExhaustDuct {
  points: ExhaustPoint[];
  diameterMm: number;
}

export interface ExhaustLayout {
  // Um ramal por secadora, da saída traseira até o coletor (a 45°).
  branches: (ExhaustDuct & { catalogId: string })[];
  // Trechos do coletor, com o diâmetro de cada estação (cresce até a saída).
  collector: ExhaustDuct[];
  // Do canto do coletor, atravessando a parede, até o bocal virado pra baixo.
  exit: ExhaustDuct;
  cleaningCap: ExhaustPoint; // tampa removível, ponta fechada do coletor
  // Maior caminho (secadora mais distante até o bocal) e o limite do manual.
  lengthMm: number;
  maxLengthMm: number;
  withinLimit: boolean;
  // Folga do bocal até o piso do lado de fora (mín. 910 mm).
  terminationClearanceMm: number;
  // Diâmetro da saída (maior do coletor) — manga na parede = + 2 x 50 mm.
  outletDiameterMm: number;
  exitSide: "start" | "end";
}

export interface ExhaustInput {
  machines: CatalogMachine[]; // fileira em ordem
  alongStarts: number[]; // início (a) de cada máquina
  drywallAcrossMm: number; // c da linha do drywall (frente das máquinas)
  alongLengthMm: number;
  ceilingMm: number;
  techAccessSide: "left" | "right"; // lado da porta técnica (a saída vai pro oposto)
}

const dist = (p: ExhaustPoint, q: ExhaustPoint) => Math.hypot(q.a - p.a, q.c - p.c, q.y - p.y);
const pathLength = (pts: ExhaustPoint[]) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);

export function computeExhaust(input: ExhaustInput): ExhaustLayout | null {
  const { machines, alongStarts, drywallAcrossMm, alongLengthMm, ceilingMm } = input;

  const dryers = machines
    .map((m, i) => ({ m, a: alongStarts[i] + m.widthMm / 2, i }))
    .filter(({ m }) => m.type === "secadora" || m.type === "stack")
    .map(({ m, a }) => ({
      catalogId: m.id,
      a,
      back: drywallAcrossMm - m.depthMm, // c das costas da máquina
      // saída medida da base da máquina; base/suporte embaixo sobe junto
      portY: (m.exhaustHeightMm ?? m.heightMm - PORT_BELOW_TOP_MM) + machineBaseMm(m),
      diameterMm: m.exhaustDiameterMm ?? DEFAULT_EXHAUST_DIAMETER_MM,
      stepUpEveryMm: m.exhaustStepUpEveryMm,
    }));
  if (dryers.length === 0) return null;

  // A saída fica no fim da fileira OPOSTO à porta técnica (porta à direita →
  // fluxo vai pro começo do eixo), dentro da faixa lateral de 50 cm.
  const rowStart = Math.min(...alongStarts);
  const rowEnd = Math.max(...machines.map((m, i) => alongStarts[i] + m.widthMm));
  const exitAtStart = input.techAccessSide === "right";
  const exitA = exitAtStart
    ? Math.max(EXIT_END_MARGIN_MM, rowStart - EXIT_END_MARGIN_MM)
    : Math.min(alongLengthMm - EXIT_END_MARGIN_MM, rowEnd + EXIT_END_MARGIN_MM);
  const flow = exitAtStart ? -1 : 1;

  // Estação A = a secadora mais longe da saída.
  const ordered = [...dryers].sort((p, q) => flow * (p.a - q.a));

  // Coletor: acima da saída mais alta, sempre abaixo do teto.
  const stationDia = (k: number) =>
    Math.max(
      COLLECTOR_STATIONS_MM[Math.min(k, COLLECTOR_STATIONS_MM.length) - 1],
      Math.max(...ordered.slice(0, k).map((d) => d.diameterMm))
    );
  const collectorDiameterMm = stationDia(ordered.length);
  // Saída baixa (ST055: na base traseira) ainda tem que deixar o bocal a 91 cm
  // do piso do lado de fora: o coletor sobe o bastante pra isso.
  const yCollector = Math.min(
    Math.max(
      Math.max(...dryers.map((d) => d.portY)) + COLLECTOR_RISE_MM,
      MIN_TERMINATION_CLEARANCE_MM + DROP_MM + collectorDiameterMm / 2
    ),
    ceilingMm - CEILING_GAP_MM - collectorDiameterMm / 2
  );

  // Todos os ramais chegam a 45° (em planta) no mesmo eixo do coletor.
  // Saída baixa demais pro espaço atrás da máquina: sobe reto e só o fim vai a 45°.
  const cMin = collectorDiameterMm / 2 + WALL_DUCT_CLEARANCE_MM;
  const ramp = (d: (typeof dryers)[number]) =>
    Math.max(RAMP_MIN_MM, Math.min(yCollector - d.portY, d.back - STUB_MIN_MM - cMin));
  const cCollector = Math.max(cMin, Math.min(...dryers.map((d) => d.back - STUB_MIN_MM - ramp(d))));

  const branches = ordered.map((d) => {
    const r = ramp(d);
    const turn = cCollector + r;
    const riseTo = yCollector - r; // > portY só quando o ramal precisa subir reto antes
    return {
      catalogId: d.catalogId,
      diameterMm: d.diameterMm,
      points: [
        { a: d.a, c: d.back, y: d.portY },
        { a: d.a, c: turn, y: d.portY }, // reto, curva longa de 90° atrás da máquina
        ...(riseTo > d.portY + 1 ? [{ a: d.a, c: turn, y: riseTo }] : []), // sobe reto (curvas de 45°)
        { a: d.a + flow * r, c: cCollector, y: yCollector }, // 45° até o coletor, a favor do fluxo
      ],
    };
  });

  // Coletor: da ponta fechada até o canto, trocando de diâmetro a cada ramal.
  const junctions = branches.map((b) => b.points[b.points.length - 1].a);
  const collectorStart: ExhaustPoint = { a: ordered[0].a, c: cCollector, y: yCollector };
  const corner: ExhaustPoint = { a: exitA, c: cCollector, y: yCollector };
  const stops = [collectorStart.a, ...junctions.slice(1), corner.a];
  const collector: ExhaustDuct[] = [];
  let from = collectorStart.a;
  // Antes do 1º ramal e até o 2º: estação A; depois cada ramal sobe uma estação.
  for (let k = 1; k <= ordered.length; k++) {
    const to = stops[k];
    if (flow * (to - from) > 0 || k === ordered.length) {
      collector.push({
        diameterMm: stationDia(k),
        points: [
          { a: from, c: cCollector, y: yCollector },
          { a: to, c: cCollector, y: yCollector },
        ],
      });
    }
    from = to;
  }

  // ST055: a cada 3,5 m de trajeto o duto cresce 2" sobre a saída de origem.
  const stepEvery = Math.min(...ordered.map((d) => d.stepUpEveryMm ?? Infinity));
  const reach = pathLength(branches[0].points) + Math.abs(exitA - collectorStart.a) + WALL_THICKNESS_MM + OUTSIDE_RUN_MM + DROP_MM;
  const outletDiameterMm = Number.isFinite(stepEvery)
    ? Math.round(collectorDiameterMm + 50.8 * Math.floor(reach / stepEvery))
    : collectorDiameterMm;

  const yEnd = yCollector - DROP_MM;
  const exit: ExhaustDuct = {
    diameterMm: outletDiameterMm,
    points: [
      corner,
      { a: exitA, c: -WALL_THICKNESS_MM - OUTSIDE_RUN_MM, y: yCollector },
      { a: exitA, c: -WALL_THICKNESS_MM - OUTSIDE_RUN_MM, y: yEnd }, // bocal virado pra baixo
    ],
  };

  // Caminho mais longo: secadora mais distante → coletor → saída.
  const first = branches[0];
  const collectorLen = Math.abs(corner.a - first.points[2].a);
  const lengthMm = Math.round(pathLength(first.points) + collectorLen + pathLength(exit.points));
  const maxLengthMm = ordered.length > 1 ? MAX_LENGTH_SHARED_MM : MAX_LENGTH_SINGLE_MM;

  return {
    branches,
    collector,
    exit,
    cleaningCap: collectorStart,
    lengthMm,
    maxLengthMm,
    withinLimit: lengthMm <= maxLengthMm,
    terminationClearanceMm: Math.round(yEnd - outletDiameterMm / 2),
    outletDiameterMm,
    exitSide: exitAtStart ? "start" : "end",
  };
}

// Pé-direito mínimo que ainda deixa o coletor passar com folga do teto.
export function minCeilingForExhaustMm(machines: CatalogMachine[]): number {
  const tallest = Math.max(...machines.map((m) => m.heightMm));
  return tallest + CEILING_CLEARANCE_MM;
}
