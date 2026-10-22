import type { CatalogMachine } from "./types";
import { WALL_THICKNESS_MM } from "./exhaust";

// Hidráulica e esgoto das lavadoras (Ebook Évora "Stack Elétrica" + resumo
// SSU/SSG). Tudo em mm no referencial LOCAL da fileira (a = ao longo da
// parede das máquinas, c = da parede de trás da área técnica pro salão,
// y = altura do piso), o mesmo da exaustão.
//
// Água: pressurizador na área técnica → barramento NO PISO atrás das máquinas
// → por lavadora um tubo que sobe do chão (com registro no meio, pra abrir e
// fechar a água) até a altura dos galões e termina num "T" de 3/4"; cada
// ponta do T tem um cotovelo de 90° virado pra máquina, onde entra a
// mangueira trançada, que sobe colada na traseira até as 2 entradas lado a
// lado, logo abaixo das bombas dosadoras (como em img/fundo-maq). Esgoto SUSPENSO: cada
// lavadora despeja num tubo vertical RETO e aberto (ladrão), ligado a um tubo
// suspenso em suportes, ABAIXO das saídas de drenagem; o diâmetro cresce 25%
// do diâmetro A (3") a cada máquina e sai pela parede de trás, com respiro.
// Um ralinho no piso da área técnica, junto da parede de trás, escoa a água
// que cair no chão.
// Dosagem: por lavadora, um par de galões (detergente e amaciante) no chão
// atrás dela e, logo acima, um par de bombas dosadoras coladas na traseira.

// --- Normas do material --------------------------------------------------
export const STANDPIPE_HEIGHT_MM = 700; // altura recomendada do tubo de dreno: boca a 70 cm do piso
export const DOSING_JUG_HEIGHT_MM = 345; // galão de 20 L no chão (modelo Jug)
// T da água na altura dos galões, como na instalação real (img/fundo-maq).
// O manual sugere pontos a 60-100 cm, mas aqui as mangueiras vão retas até a máquina.
export const WATER_POINT_HEIGHT_MM = DOSING_JUG_HEIGHT_MM;
export const WATER_POINT_HEIGHT_RANGE_MM = [600, 1000] as const; // faixa do manual (referência)
export const WATER_POINTS_PER_WASHER = 2; // 1 "T" com 2 saídas de 3/4"
export const WATER_BRANCH_DIAMETER_MM = 25; // 3/4"
export const WATER_PRESSURE_KPA = { min: 200, max: 570 } as const; // 30-85 psi
export const WATER_FLOW_PER_WASHER_LPM = 40; // vazão máxima de entrada por máquina
export const DRAIN_FLOW_PER_WASHER_LPM = 14; // vazão do dreno por máquina
export const STANDPIPE_DIAMETER_MM = 50; // tubo de PVC p/ a mangueira: 4 a 5 cm
export const DRAIN_BASE_DIAMETER_MM = 76.2; // "A" = 3 pol
export const DRAIN_STEP_FRACTION = 0.25; // +25% de A a cada máquina no ramal
export const VENT_SPACING_MM = 20000; // um respiro a cada 20 m de tubulação
export const VENT_DIAMETER_MM = 50;

// --- Estimativas de projeto (não constam do material) --------------------
export const WATER_MAX_VELOCITY_MS = 2.5; // NBR 5626, p/ dimensionar o barramento
export const WATER_PIPE_SIZES_MM = [25, 32, 40, 50, 60, 75, 85];
export const PUMP_MODEL = "Pressurizador Komeco TP825 G3 (bivolt)"; // planilha de links
const PUMP_ALONG_OFFSET_MM = 600; // bomba atrás da 1ª máquina a partir da saída
const PUMP_INLET_C_MM = 250; // frente da bomba (conexão de entrada), a partir da parede
const PUMP_INLET_Y_MM = 150;
const MANIFOLD_FLOOR_GAP_MM = 10; // barramento apoiado no piso (abraçadeiras)
const MANIFOLD_BEHIND_DRAIN_MM = 60; // atrás do tubo de esgoto, rumo à parede
const RISER_A_MM = -285; // tubo que sobe, do centro da máquina (lado oposto ao dreno, fora dos galões)
export const WATER_TEE_ARM_MM = 50; // cada braço do T de água
export const WATER_ELBOW_MM = 50; // cotovelo de 90°: saída virada pra máquina (+c)
const WATER_INLETS_GAP_MM = 60; // 2 entradas de água lado a lado na traseira
const WATER_INLET_A_MM = -215; // centro das entradas, do centro da máquina (perto da bomba do detergente)
const WATER_INLET_BELOW_PUMPS_MM = 200; // entradas logo abaixo das bombas dosadoras
const HOSE_OFF_BACK_MM = 50; // mangueira sobe a uns 5 cm da traseira
const JUG_BEHIND_MANIFOLD_MM = 160; // galões atrás do barramento, sem encostar nele
const JUG_RADIUS_MM = 95;
export const FLOOR_DRAIN_SIZE_MM = 100; // ralinho de 10 x 10 cm
const FLOOR_DRAIN_C_MM = 200; // junto da parede de trás
const OUTSIDE_RUN_MM = 400;
export const DRAIN_LINE_Y_MM = 150; // eixo do tubo de esgoto suspenso (topo < saída de dreno a 250)
export const DRAIN_LINE_SUPPORT_SPACING_MM = 800; // suportes do tubo suspenso
const STANDPIPE_OFFSET_MM = 325; // tubo de dreno junto da borda da máquina
const DRAIN_LINE_BEHIND_MACHINE_MM = 100; // tubo suspenso colado atrás da máquina
export const DOSING_PUMPS_PER_WASHER = 2; // um par de bombas dosadoras por maquinário
export const DOSING_JUGS_PER_WASHER = 2; // galão de detergente + galão de amaciante
export const DOSING_PUMP_Y_MM = 1100; // centro das bombas: ACIMA dos pontos de água (a 85 cm)
export const DOSING_SPACING_MM = 120; // centro das bombas/galões a partir do centro da máquina
// Entradas de dosagem: depois da bomba do amaciante, antes do tubo de dreno
// (a + 325), na altura das bombas (estimativa, como na foto img/fundo-maq).
const DOSING_INLET_A_MM = [215, 255];
const DOSING_INLET_Y_MM = DOSING_PUMP_Y_MM + 30;
const DOSING_JUG_BEHIND_MACHINE_MM = 300;
const SEWER_INWARD_MM = 150; // esgoto sai um pouco pra dentro da saída da exaustão (que sai em cima)
const VENT_CEILING_GAP_MM = 200;
const DRAIN_PORT_Y_MM = 250; // saída de drenagem traseira da lavadora
const HOSE_LOOP_Y_MM = 850; // laço da mangueira: 61 a 91 cm

export interface HydraulicPoint {
  a: number;
  c: number;
  y: number;
}

export interface WasherHydraulics {
  catalogId: string;
  a: number; // centro da máquina
  // Água: tubo que sobe do barramento no piso até o T (registro no meio) e
  // as 2 mangueiras do T até a traseira da máquina.
  water: {
    riser: HydraulicPoint[]; // [no piso, no T]
    valve: HydraulicPoint;
    tee: HydraulicPoint[]; // pontas dos 2 braços do T
    elbows: HydraulicPoint[]; // saída de cada cotovelo de 90° (virada pra máquina)
    inlets: HydraulicPoint[]; // entradas de água na traseira, lado a lado
    hoses: HydraulicPoint[][]; // cotovelo → entrada
  };
  waterPointHeightMm: number;
  // Tubo individual da máquina: RETO, sobe do tubo de esgoto central (baixo)
  // até a boca aberta a 70 cm do piso, onde entra a mangueira do dreno.
  standpipe: { a: number; c: number; diameterMm: number; topY: number; baseY: number };
  // Dosagem: par de bombas na traseira da máquina (c = costas das bombas) e
  // par de galões no chão atrás dela; [0] = lado de menor a (detergente),
  // [1] = lado de maior a (amaciante), cada galão sob a sua bomba.
  dosing: {
    pumps: { a: number; c: number; y: number }[];
    jugs: { a: number; c: number; kind: "detergente" | "amaciante" }[];
    // Entradas de dosagem (furos com anel) na traseira da máquina, na altura
    // das bombas e ao lado delas; [k] recebe o tubinho da bomba [k].
    inlets: HydraulicPoint[];
  };
  // Mangueira: saída de drenagem traseira → laço a 61-91 cm → boca do tubo.
  hose: HydraulicPoint[];
}

export interface HydraulicsLayout {
  pump: {
    model: string;
    a: number; // posição ao longo da parede
    inlet: HydraulicPoint; // conexão de entrada (frente da bomba)
  };
  // Entrada de água pela parede de trás até a bomba.
  waterEntry: { through: HydraulicPoint; outside: HydraulicPoint; diameterMm: number };
  // Saída da bomba → barramento (corre ao longo das máquinas).
  manifold: { points: HydraulicPoint[]; diameterMm: number };
  washers: WasherHydraulics[];
  // Tubo de esgoto SUSPENSO (sem ralo): trechos com diâmetro crescente rumo à
  // saída, sobre suportes, abaixo das saídas de dreno das máquinas.
  drainLine: { points: HydraulicPoint[]; diameterMm: number }[];
  drainSupports: HydraulicPoint[]; // pontos (a, c) dos suportes, no tubo suspenso
  // Linha de esgoto atravessando a parede de trás.
  sewerExit: { inside: HydraulicPoint; outside: HydraulicPoint; diameterMm: number };
  vents: { a: number; c: number; diameterMm: number; topY: number }[];
  // Ralinho no piso da área técnica (escoamento), junto da parede de trás.
  floorDrain: { a: number; c: number; sizeMm: number };
  summary: {
    washers: number;
    supplyFlowLpm: number;
    drainFlowLpm: number;
    mainDiameterMm: number;
    drainDiameterMm: number;
    dosingPumps: number;
    pressureKpa: { min: number; max: number };
  };
}

// Diâmetro comercial do barramento pela vazão (vel. máx. 2,5 m/s).
export function waterMainDiameterMm(washers: number): number {
  const q = (washers * WATER_FLOW_PER_WASHER_LPM) / 1000 / 60; // m³/s
  const dInner = Math.sqrt((4 * q) / (Math.PI * WATER_MAX_VELOCITY_MS)) * 1000;
  return WATER_PIPE_SIZES_MM.find((d) => d >= dInner + 3) ?? WATER_PIPE_SIZES_MM[WATER_PIPE_SIZES_MM.length - 1];
}

// Estação k (1 = ponta mais longe da saída): A + 25% de A a cada máquina.
export function drainDiameterMmAt(station: number, minDiameterMm = DRAIN_BASE_DIAMETER_MM): number {
  return Math.max(minDiameterMm, DRAIN_BASE_DIAMETER_MM * (1 + DRAIN_STEP_FRACTION * (station - 1)));
}

function drainDiameterMm(m: CatalogMachine): number {
  const inches = m.drainInch ? parseFloat(m.drainInch) : NaN;
  return Number.isFinite(inches) ? inches * 25.4 : STANDPIPE_DIAMETER_MM;
}

export interface HydraulicsInput {
  machines: CatalogMachine[];
  alongStarts: number[];
  drywallAcrossMm: number;
  alongLengthMm: number;
  ceilingMm: number;
  techAccessSide: "left" | "right";
}

export function computeHydraulics(input: HydraulicsInput): HydraulicsLayout | null {
  const { machines, alongStarts, drywallAcrossMm, alongLengthMm, ceilingMm } = input;

  const washers = machines
    .map((m, i) => ({
      m,
      a: alongStarts[i] + m.widthMm / 2,
      back: drywallAcrossMm - m.depthMm,
    }))
    .filter(({ m }) => m.type === "lavadora" || m.type === "stack");
  if (washers.length === 0) return null;

  // Mesmo lado da exaustão: oposto à porta técnica (faixa lateral de 50 cm).
  const exitAtStart = input.techAccessSide === "right";
  const flow = exitAtStart ? -1 : 1; // sentido do fluxo, rumo à saída
  const rowStart = Math.min(...alongStarts);
  const rowEnd = Math.max(...machines.map((m, i) => alongStarts[i] + m.widthMm));
  const exitA = exitAtStart ? Math.max(250, rowStart - 250) : Math.min(alongLengthMm - 250, rowEnd + 250);

  // Estação A = a lavadora mais longe da saída.
  const ordered = [...washers].sort((p, q) => flow * (p.a - q.a));
  const backMin = Math.min(...washers.map((w) => w.back));

  // --- Bomba, entrada de água e barramento -------------------------------
  const pumpA = exitA - flow * PUMP_ALONG_OFFSET_MM;
  const mainDia = waterMainDiameterMm(washers.length);
  const cDrain = backMin - DRAIN_LINE_BEHIND_MACHINE_MM; // tubo suspenso, colado atrás das máquinas
  const maxDrain = Math.max(...washers.map((w) => drainDiameterMm(w.m)));
  const drainDia = drainDiameterMmAt(washers.length, maxDrain);
  // Barramento no piso, atrás do tubo de esgoto (os tubos que sobem não cruzam o esgoto).
  const cManifold = cDrain - drainDia / 2 - MANIFOLD_BEHIND_DRAIN_MM - mainDia / 2;
  const manifoldY = mainDia / 2 + MANIFOLD_FLOOR_GAP_MM;
  const inlet: HydraulicPoint = { a: pumpA, c: PUMP_INLET_C_MM, y: PUMP_INLET_Y_MM };
  const waterEntry = {
    through: { a: pumpA, c: 0, y: PUMP_INLET_Y_MM },
    outside: { a: pumpA, c: -WALL_THICKNESS_MM - OUTSIDE_RUN_MM, y: PUMP_INLET_Y_MM },
    diameterMm: mainDia,
  };
  const manifoldA = [pumpA, ...washers.map((w) => w.a + RISER_A_MM)];
  const manifold = {
    diameterMm: mainDia,
    points: [
      // sai da bomba (a posição exata da saída vem do modelo 3D), desce e corre no piso
      { a: pumpA, c: cManifold, y: manifoldY },
      { a: Math.min(...manifoldA), c: cManifold, y: manifoldY },
      { a: Math.max(...manifoldA), c: cManifold, y: manifoldY },
    ],
  };

  // --- Lavadoras: água, dreno e dosagem -----------------------------------
  const perWasher: WasherHydraulics[] = ordered.map((w) => {
    const aDrain = w.a + STANDPIPE_OFFSET_MM;
    const aRiser = w.a + RISER_A_MM;
    const teeY = WATER_POINT_HEIGHT_MM;
    const tee = [-1, 1].map((k) => ({ a: aRiser + k * WATER_TEE_ARM_MM, c: cManifold, y: teeY }));
    const elbows = tee.map((t) => ({ ...t, c: t.c + WATER_ELBOW_MM }));
    const inlets = [-1, 1].map((k) => ({
      a: w.a + WATER_INLET_A_MM + (k * WATER_INLETS_GAP_MM) / 2,
      c: w.back,
      y: DOSING_PUMP_Y_MM - WATER_INLET_BELOW_PUMPS_MM,
    }));
    // Galões entre o esgoto e a máquina quando cabem; senão, atrás do barramento.
    const jugFront = w.back - DOSING_JUG_BEHIND_MACHINE_MM;
    const jugC =
      jugFront - JUG_RADIUS_MM > cDrain + drainDia / 2 + 20 ? jugFront : cManifold - JUG_BEHIND_MANIFOLD_MM;
    return {
      catalogId: w.m.id,
      a: w.a,
      waterPointHeightMm: WATER_POINT_HEIGHT_MM,
      water: {
        riser: [
          { a: aRiser, c: cManifold, y: manifoldY },
          { a: aRiser, c: cManifold, y: teeY },
        ],
        valve: { a: aRiser, c: cManifold, y: Math.round((manifoldY + teeY) / 2) },
        tee,
        elbows,
        inlets,
        // do cotovelo (lá embaixo) a mangueira vai pra máquina e sobe colada
        // na traseira até a entrada, perto das dosadoras
        hoses: elbows.map((e, k) => [
          e,
          { a: (e.a + inlets[k].a) / 2, c: w.back - HOSE_OFF_BACK_MM, y: (e.y + inlets[k].y) / 2 },
          inlets[k],
        ]),
      },
      standpipe: {
        a: aDrain,
        c: cDrain,
        diameterMm: Math.max(STANDPIPE_DIAMETER_MM, drainDiameterMm(w.m)),
        topY: STANDPIPE_HEIGHT_MM,
        baseY: DRAIN_LINE_Y_MM,
      },
      // Sai da traseira, sobe (afastada das bombas) ao laço de 61-91 cm e
      // desce reto pra dentro da boca do tubo de dreno.
      hose: [
        { a: aDrain, c: w.back, y: DRAIN_PORT_Y_MM },
        { a: aDrain, c: w.back - 40, y: DRAIN_PORT_Y_MM + 50 },
        { a: aDrain, c: w.back - 40, y: HOSE_LOOP_Y_MM },
        { a: aDrain, c: cDrain, y: HOSE_LOOP_Y_MM },
        { a: aDrain, c: cDrain, y: STANDPIPE_HEIGHT_MM - 60 }, // dentro da boca do tubo
      ],
      dosing: {
        pumps: [-1, 1].map((side) => ({
          a: w.a + side * DOSING_SPACING_MM,
          c: w.back, // costas coladas na traseira da máquina
          y: DOSING_PUMP_Y_MM,
        })),
        jugs: [-1, 1].map((side) => ({
          a: w.a + side * DOSING_SPACING_MM,
          c: jugC,
          kind: side < 0 ? ("detergente" as const) : ("amaciante" as const),
        })),
        inlets: DOSING_INLET_A_MM.map((da) => ({ a: w.a + da, c: w.back, y: DOSING_INLET_Y_MM })),
      },
    };
  });

  // --- Esgoto suspenso (abaixo das saídas de drenagem) -------------------
  const drainStops = perWasher.map((w) => w.standpipe.a);
  const sewerAStop = exitA - flow * SEWER_INWARD_MM;
  const stops = [...drainStops, sewerAStop];
  const drainLine: HydraulicsLayout["drainLine"] = [];
  for (let k = 1; k <= ordered.length; k++) {
    drainLine.push({
      diameterMm: drainDiameterMmAt(k, maxDrain),
      points: [
        { a: stops[k - 1], c: cDrain, y: DRAIN_LINE_Y_MM },
        { a: stops[k], c: cDrain, y: DRAIN_LINE_Y_MM },
      ],
    });
  }
  // Último trecho: do fim da fileira até a parede de trás (mesma bitola da saída).
  drainLine.push({
    diameterMm: drainDia,
    points: [
      { a: sewerAStop, c: cDrain, y: DRAIN_LINE_Y_MM },
      { a: sewerAStop, c: 0, y: DRAIN_LINE_Y_MM },
    ],
  });
  const sewerExit = {
    inside: { a: sewerAStop, c: 0, y: DRAIN_LINE_Y_MM },
    outside: { a: sewerAStop, c: -WALL_THICKNESS_MM - OUTSIDE_RUN_MM, y: DRAIN_LINE_Y_MM },
    diameterMm: drainDia,
  };

  // Suportes do tubo suspenso, a cada 800 mm ao longo de todo o trajeto.
  const drainSupports: HydraulicPoint[] = [];
  for (const seg of drainLine) {
    const [p, q] = seg.points;
    const len = Math.hypot(q.a - p.a, q.c - p.c);
    const n = Math.max(1, Math.round(len / DRAIN_LINE_SUPPORT_SPACING_MM));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      drainSupports.push({ a: p.a + (q.a - p.a) * t, c: p.c + (q.c - p.c) * t, y: DRAIN_LINE_Y_MM });
    }
  }

  // Respiro: um a cada 20 m de tubulação (mín. 1), na ponta fechada do tubo.
  const drainLength = Math.abs(sewerAStop - drainStops[0]) + cDrain;
  const ventCount = Math.max(1, Math.ceil(drainLength / VENT_SPACING_MM));
  const vents = Array.from({ length: ventCount }, (_, i) => ({
    a: drainStops[0] - flow * 120 + flow * VENT_SPACING_MM * i,
    c: cDrain,
    diameterMm: VENT_DIAMETER_MM,
    topY: ceilingMm - VENT_CEILING_GAP_MM,
  }));

  return {
    pump: { model: PUMP_MODEL, a: pumpA, inlet },
    waterEntry,
    manifold,
    washers: perWasher,
    drainLine,
    drainSupports,
    sewerExit,
    vents,
    // Ralinho na ponta da fileira longe da saída, junto da parede de trás.
    floorDrain: { a: drainStops[0], c: FLOOR_DRAIN_C_MM, sizeMm: FLOOR_DRAIN_SIZE_MM },
    summary: {
      washers: washers.length,
      supplyFlowLpm: washers.length * WATER_FLOW_PER_WASHER_LPM,
      drainFlowLpm: washers.length * DRAIN_FLOW_PER_WASHER_LPM,
      mainDiameterMm: mainDia,
      drainDiameterMm: Math.round(drainDia * 10) / 10,
      dosingPumps: washers.length * DOSING_PUMPS_PER_WASHER,
      pressureKpa: { ...WATER_PRESSURE_KPA },
    },
  };
}
