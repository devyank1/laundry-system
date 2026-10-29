import type { Layout, Rect, WallSide } from "./types";

// Prancha elétrica no padrão das pranchas de projeto (img/ele1 + legenda
// img/ele2): duas plantas, uma de ILUMINAÇÃO (pontos 1a/1b/1c em perfilado no
// teto, circuitos por letra, fita de LED e letreiro) e uma de TOMADAS
// (127 V / 220 V / Steck / ar-condicionado / pressurizador, circuitos por
// número, eletroduto no teto ou no piso). Tudo sai do QD-01 na área técnica.
// Coordenadas da PLANTA (mm): x da esquerda, y de cima; fachada em y = fundo.

export interface PlanXY {
  x: number;
  y: number;
}

// 1a = área técnica, 1b = salão, 1c = marquise (como nas pranchas).
export type LightKind = "1a" | "1b" | "1c";
export interface Luminaire extends PlanXY {
  kind: LightKind;
  circuit: string;
}

// perfilado = perfilado perfurado no teto; teto/piso = eletroduto.
export type RunKind = "perfilado" | "teto" | "piso";
export interface ConduitRun {
  kind: RunKind;
  points: PlanXY[];
  circuit: string | null; // null = tronco com vários circuitos
}

export type DeviceKind =
  | "interruptor"
  | "tomada127baixa"
  | "tomada127media"
  | "tomada220"
  | "steck"
  | "forca"
  | "pressurizador"
  | "ar"
  | "modem";
export interface ElectricDevice extends PlanXY {
  kind: DeviceKind;
  circuit: string;
  // Parede em que está (o símbolo aponta pro ambiente); null = caixa de piso.
  wall: WallSide | null;
  label?: string;
}

export interface Circuit {
  id: string;
  description: string;
  voltage: 127 | 220;
}

export interface ElectricalPlan {
  // wall = parede (no plano) em que o quadro está. face "side" = parede
  // lateral (alvenaria) ao lado da porta técnica, dentro da área técnica (o
  // normal); "drywall" = no drywall, lado técnico; "wall" = parede de trás.
  // mount = centro da face da parede, no referencial da fileira (o 3D monta
  // quadro e modem por ele); highEnd = lateral do fim da fileira.
  panel: Rect & {
    label: string;
    wall: WallSide;
    face: "side" | "drywall" | "wall";
    mount: { alongMm: number; acrossMm: number; highEnd: boolean };
  };
  lighting: {
    luminaires: Luminaire[];
    runs: ConduitRun[];
    junctions: PlanXY[]; // junção T/X do perfilado
    devices: ElectricDevice[];
    ledStrip: { points: PlanXY[]; circuit: string } | null;
  };
  power: { devices: ElectricDevice[]; runs: ConduitRun[] };
  circuits: Circuit[];
}

const PANEL_ALONG_MM = 500;
const PANEL_DEPTH_MM = 100;
const DRYWALL_HALF_MM = 50;
const PANEL_DOOR_GAP_MM = 100; // do batente da porta técnica até o quadro
const TECH_LIGHT_SPACING_MM = 1500;
const SALON_COL_SPACING_MM = 1600;
const SALON_ROW_SPACING_MM = 1800;
const MARQUISE_LIGHT_SPACING_MM = 1500;
const MARQUISE_LIGHT_OUT_MM = 750; // da fachada até a fileira 1c (meio da marquise)
const SIGN_OUT_MM = 300; // letreiro: logo à frente da fachada
const SWITCH_FROM_DOOR_MM = 250;
const FLOOR_ROUTE_MM = 300; // eletroduto de piso sai pelo corredor técnico
const FLOOR_LANE_MM = 150;
// Atrás de cada máquina, no perfilado: tomada 220 V da lavadora, tomada 220 V
// das dosadoras e a Steck da secadora, lado a lado.
const SOCKET_SHIFT_MM = 170;
const COUNTER_SOCKETS = 3; // balcão: uma tomada 127 V por banqueta


const ROOM_NORMAL: Record<WallSide, PlanXY> = {
  top: { x: 0, y: 1 },
  bottom: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

function spread(length: number, spacing: number, min: number): number[] {
  const n = Math.max(min, Math.round(length / spacing));
  return Array.from({ length: n }, (_, i) => Math.round((length * (i + 0.5)) / n));
}

function wallPoint(r: Rect, wall: WallSide): PlanXY {
  switch (wall) {
    case "left":
      return { x: r.x, y: r.y + r.height / 2 };
    case "right":
      return { x: r.x + r.width, y: r.y + r.height / 2 };
    case "top":
      return { x: r.x + r.width / 2, y: r.y };
    case "bottom":
      return { x: r.x + r.width / 2, y: r.y + r.height };
  }
}

const center = (r: Rect): PlanXY => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const dist = (p: PlanXY, q: PlanXY) => Math.hypot(p.x - q.x, p.y - q.y);

export function computeElectricalPlan(layout: Omit<Layout, "electricalPlan">): ElectricalPlan {
  const { roomWidthMm: W, roomDepthMm: D, furniture, electrical, hydraulics } = layout;
  const side = layout.orientation === "side";
  const drywallC = layout.drywall.y;
  const alongLen = side ? D : W;
  const acrossLen = side ? W : D;
  const toPlan = (a: number, c: number): PlanXY =>
    side ? { x: layout.machineWall === "left" ? c : W - c, y: a } : { x: a, y: c };
  const backWall: WallSide = side ? layout.machineWall : "top";
  const corridorA = side
    ? layout.techCorridor.y + layout.techCorridor.height / 2
    : layout.techCorridor.x + layout.techCorridor.width / 2;

  // QD-01 na parede lateral (alvenaria, a cinza) ao lado da porta técnica,
  // dentro da área técnica e fora do giro da porta, como no QD-01 de
  // img/ele1; o modem fica logo abaixo dele. Se a área técnica for rasa
  // demais, vai pro drywall entre as máquinas e a porta; sem isso, pra parede
  // de trás.
  const corr0 = side ? layout.techCorridor.y : layout.techCorridor.x;
  const corr1 = corr0 + (side ? layout.techCorridor.height : layout.techCorridor.width);
  const spans = layout.machines.map((m) => (side ? [m.y, m.y + m.depthMm] : [m.x, m.x + m.widthMm]));
  const rowStart = spans.length ? Math.min(...spans.map((sp) => sp[0])) : alongLen;
  const rowEnd = spans.length ? Math.max(...spans.map((sp) => sp[1])) : 0;
  const need = PANEL_ALONG_MM + PANEL_DOOR_GAP_MM;
  const faceC = drywallC - DRYWALL_HALF_MM;
  const highEnd = corridorA > alongLen / 2; // porta técnica na ponta do fim da fileira
  // a porta abre pra dentro da área técnica, encostada na lateral
  const sideC = faceC - layout.techDoor.width - PANEL_DOOR_GAP_MM - PANEL_ALONG_MM / 2;
  // parede (no plano) pra onde aponta um vetor (da, dc) do referencial da fileira
  const wallToward = (da: number, dc: number): WallSide => {
    const v = { x: toPlan(da, dc).x - toPlan(0, 0).x, y: toPlan(da, dc).y - toPlan(0, 0).y };
    return Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? "right" : "left") : v.y > 0 ? "bottom" : "top";
  };
  let face: "side" | "drywall" | "wall";
  let panelA: number; // ponto de saída do quadro (frente), no referencial da fileira
  let outC: number;
  let rectA: [number, number];
  let rectC: [number, number];
  let wall: WallSide;
  if (sideC - PANEL_ALONG_MM / 2 >= PANEL_DOOR_GAP_MM) {
    face = "side";
    panelA = highEnd ? alongLen - PANEL_DEPTH_MM : PANEL_DEPTH_MM;
    outC = sideC;
    rectA = highEnd ? [alongLen - PANEL_DEPTH_MM, alongLen] : [0, PANEL_DEPTH_MM];
    rectC = [sideC - PANEL_ALONG_MM / 2, sideC + PANEL_ALONG_MM / 2];
    wall = wallToward(highEnd ? 1 : -1, 0);
  } else if ((corr0 >= rowEnd && corr0 - rowEnd >= need) || (corr1 <= rowStart && rowStart - corr1 >= need)) {
    face = "drywall";
    panelA = corr0 >= rowEnd && corr0 - rowEnd >= need
      ? corr0 - PANEL_DOOR_GAP_MM - PANEL_ALONG_MM / 2
      : corr1 + PANEL_DOOR_GAP_MM + PANEL_ALONG_MM / 2;
    outC = faceC - PANEL_DEPTH_MM;
    rectA = [panelA - PANEL_ALONG_MM / 2, panelA + PANEL_ALONG_MM / 2];
    rectC = [outC, faceC];
    wall = wallToward(0, 1);
  } else {
    face = "wall";
    panelA = Math.min(
      alongLen - PANEL_ALONG_MM / 2,
      Math.max(PANEL_ALONG_MM / 2, electrical ? electrical.feed.a : corridorA)
    );
    outC = PANEL_DEPTH_MM;
    rectA = [panelA - PANEL_ALONG_MM / 2, panelA + PANEL_ALONG_MM / 2];
    rectC = [0, PANEL_DEPTH_MM];
    wall = backWall;
  }
  const pc0 = toPlan(rectA[0], rectC[0]);
  const pc1 = toPlan(rectA[1], rectC[1]);
  const panel = {
    x: Math.min(pc0.x, pc1.x),
    y: Math.min(pc0.y, pc1.y),
    width: Math.abs(pc1.x - pc0.x),
    height: Math.abs(pc1.y - pc0.y),
    label: "QD-01",
    wall,
    face,
    // centro da face da parede onde o quadro está, no referencial da fileira
    mount: {
      alongMm: face === "side" ? (highEnd ? alongLen : 0) : panelA,
      acrossMm: face === "side" ? sideC : face === "drywall" ? drywallC : 0,
      highEnd,
    },
  };
  const panelOut = toPlan(panelA, outC);

  const circuits: Circuit[] = [];
  const addCircuit = (id: string, description: string, voltage: 127 | 220) => {
    circuits.push({ id, description, voltage });
    return id;
  };

  // ------------------------------------------------------------ iluminação
  const luminaires: Luminaire[] = [];
  const lightRuns: ConduitRun[] = [];
  const junctions: PlanXY[] = [];
  const lightDevices: ElectricDevice[] = [];

  const salonCols = spread(alongLen, SALON_COL_SPACING_MM, 2);
  // tronco do perfilado na coluna mais perto do QD
  const spineA = salonCols.reduce((best, a) => (Math.abs(a - panelA) < Math.abs(best - panelA) ? a : best));
  const row = (c: number, as: number[], kind: LightKind, circuit: string) => {
    for (const a of as) luminaires.push({ ...toPlan(a, c), kind, circuit });
    const span = [...as, spineA, ...(kind === "1a" ? [panelA] : [])];
    lightRuns.push({
      kind: "perfilado",
      points: [toPlan(Math.min(...span), c), toPlan(Math.max(...span), c)],
      circuit,
    });
    junctions.push(toPlan(spineA, c));
  };

  const techC = Math.round(drywallC * 0.3);
  const cTech = addCircuit("A", "Iluminação da área técnica (1a)", 127);
  row(techC, spread(alongLen, TECH_LIGHT_SPACING_MM, 2), "1a", cTech);

  const salonDepth = acrossLen - drywallC;
  const rowCs = spread(salonDepth, SALON_ROW_SPACING_MM, 1).map((c) => c + drywallC);
  const cSalonA = addCircuit("B", "Iluminação do salão (1b)", 127);
  const cSalonB = rowCs.length > 1 ? addCircuit("C", "Iluminação do salão (1b), 2º circuito", 127) : cSalonA;
  rowCs.forEach((c, k) => row(c, salonCols, "1b", k % 2 === 0 ? cSalonA : cSalonB));
  const lastRowC = rowCs[rowCs.length - 1];
  lightRuns.push({ kind: "perfilado", points: [panelOut, toPlan(panelA, techC)], circuit: null });
  lightRuns.push({ kind: "perfilado", points: [toPlan(spineA, techC), toPlan(spineA, lastRowC)], circuit: null });
  if (Math.abs(panelA - spineA) > 1) junctions.push(toPlan(panelA, techC));

  // Marquise: fileira 1c fora da fachada + letreiro, em eletroduto no teto.
  const marquiseY = D + MARQUISE_LIGHT_OUT_MM;
  const marquiseXs = spread(W, MARQUISE_LIGHT_SPACING_MM, 2);
  const cMarquise = addCircuit("D", "Iluminação da marquise (1c)", 127);
  for (const x of marquiseXs) luminaires.push({ x, y: marquiseY, kind: "1c", circuit: cMarquise });
  const spineEnd = toPlan(spineA, lastRowC);
  lightRuns.push({ kind: "teto", points: [spineEnd, { x: spineEnd.x, y: marquiseY }], circuit: cMarquise });
  lightRuns.push({
    kind: "teto",
    points: [
      { x: Math.min(...marquiseXs, spineEnd.x), y: marquiseY },
      { x: Math.max(...marquiseXs, spineEnd.x), y: marquiseY },
    ],
    circuit: cMarquise,
  });
  const door = layout.frontDoor;
  const signX = door ? door.x + door.width / 2 : W / 2;
  const cSign = addCircuit("E", "Letreiro da fachada", 127);
  lightDevices.push({ x: signX, y: D + SIGN_OUT_MM, kind: "forca", circuit: cSign, wall: "top", label: "LETREIRO" });
  lightRuns.push({ kind: "teto", points: [{ x: signX, y: marquiseY }, { x: signX, y: D + SIGN_OUT_MM }], circuit: cSign });

  // Interruptor ao lado da porta de entrada, ligado ao ponto 1b mais perto.
  if (door) {
    const sx = door.x >= SWITCH_FROM_DOOR_MM * 2 ? door.x - SWITCH_FROM_DOOR_MM : door.x + door.width + SWITCH_FROM_DOOR_MM;
    const sw = { x: sx, y: D };
    lightDevices.push({ ...sw, kind: "interruptor", circuit: cSalonA, wall: "bottom", label: "S" });
    const near = luminaires
      .filter((l) => l.kind === "1b")
      .reduce((best, l) => (dist(l, sw) < dist(best, sw) ? l : best));
    lightRuns.push({ kind: "teto", points: [sw, { x: sw.x, y: near.y }, near], circuit: cSalonA });
  }

  // Fita de LED no nicho do totem.
  let ledStrip: ElectricalPlan["lighting"]["ledStrip"] = null;
  if (furniture) {
    const t = furniture.totem;
    const cLed = addCircuit("F", "Fita de LED (nicho do totem)", 127);
    const tc = center(t);
    const points =
      t.width >= t.height
        ? [{ x: t.x, y: tc.y }, { x: t.x + t.width, y: tc.y }]
        : [{ x: tc.x, y: t.y }, { x: tc.x, y: t.y + t.height }];
    ledStrip = { points, circuit: cLed };
    const near = luminaires
      .filter((l) => l.kind === "1b")
      .reduce((best, l) => (dist(l, tc) < dist(best, tc) ? l : best));
    lightRuns.push({ kind: "teto", points: [near, { x: tc.x, y: near.y }, tc], circuit: cLed });
  }

  // ------------------------------------------------------------ tomadas
  const devices: ElectricDevice[] = [];
  const runs: ConduitRun[] = [];
  let n = 0;
  const next = (description: string, voltage: 127 | 220) => addCircuit(String(++n), description, voltage);

  if (electrical) {
    const t0 = toPlan(electrical.trunk.from.a, electrical.trunk.from.c);
    const t1 = toPlan(electrical.trunk.to.a, electrical.trunk.to.c);
    runs.push({ kind: "perfilado", points: [t0, t1], circuit: null });
    runs.push({
      kind: "teto",
      points: [panelOut, toPlan(panelA, electrical.feed.c), toPlan(electrical.feed.a, electrical.feed.c)].filter(
        (q, k, all) => k === 0 || dist(q, all[k - 1]) > 1
      ),
      circuit: null,
    });
    electrical.machines.forEach((m, i) => {
      const p = toPlan(m.profile.a, m.profile.c);
      const hasWasher = m.cords.some((cord) => cord.kind === "220");
      const dosingOnly = !hasWasher && m.sockets220.length > 0;
      if (hasWasher) {
        const breaker = m.washerBreakerA ? ` (${m.washerBreakerA}A)` : "";
        const id = next(`T${i + 1}: lavadora + 2 dosadoras${breaker}`, 220);
        const lav = toPlan(m.profile.a - SOCKET_SHIFT_MM, m.profile.c);
        devices.push({ ...lav, kind: "tomada220", circuit: id, wall: backWall, label: "LAV" });
        devices.push({ ...p, kind: "tomada220", circuit: id, wall: backWall, label: "DOS" });
      } else if (dosingOnly) {
        const id = next(`T${i + 1}: 2 dosadoras`, 220);
        const dos = toPlan(m.profile.a - SOCKET_SHIFT_MM, m.profile.c);
        devices.push({ ...dos, kind: "tomada220", circuit: id, wall: backWall, label: "DOS" });
      }
      if (m.dryerSocket.amperage !== null) {
        const breaker =
          m.dryerSocket.use === "lavadora" && m.washerBreakerA ? `, disjuntor ${m.washerBreakerA}A` : "";
        const id = next(
          `T${i + 1}: ${m.dryerSocket.use}, ${m.dryerSocket.type} ${m.dryerSocket.amperage}A${breaker}`,
          220
        );
        const sp = toPlan(m.profile.a + (hasWasher || dosingOnly ? SOCKET_SHIFT_MM : 0), m.profile.c);
        devices.push({ ...sp, kind: "steck", circuit: id, wall: backWall, label: `${m.dryerSocket.amperage}A` });
      }
    });
  }

  {
    const id = next("Modem (abaixo do QD-01): tomada 127 V + ponto de rede", 127);
    devices.push({ ...panelOut, kind: "modem", circuit: id, wall: panel.wall, label: "MODEM" });
  }

  if (hydraulics) {
    const id = next("Pressurizador (ponto não plugável)", 220);
    const p = toPlan(hydraulics.pump.a, 0);
    devices.push({ ...p, kind: "pressurizador", circuit: id, wall: backWall });
    const viaC = PANEL_DEPTH_MM * 1.5;
    runs.push({
      kind: "teto",
      points: [panelOut, toPlan(panelA, viaC), toPlan(hydraulics.pump.a, viaC), p].filter((q, k, all) => k === 0 || dist(q, all[k - 1]) > 1),
      circuit: id,
    });
  }

  // Eletroduto de piso: sai do QD, passa pelo corredor técnico e corre pelo salão.
  // Cada circuito de piso corre numa faixa própria, pra não sobrepor.
  let lane = 0;
  const floorRoute = (targets: PlanXY[], circuit: string) => {
    if (targets.length === 0) return;
    const k = lane++;
    const off = FLOOR_ROUTE_MM + FLOOR_LANE_MM * k;
    // desce do quadro e passa sob o drywall, do lado da porta técnica
    const laneA = panelA + Math.sign(corridorA - panelA || 1) * FLOOR_LANE_MM * (k + 1);
    const pts = [panelOut, toPlan(laneA, outC), toPlan(laneA, drywallC + off)];
    const left = [...targets];
    while (left.length) {
      const cur = pts[pts.length - 1];
      left.sort((p, q) => dist(cur, p) - dist(cur, q));
      const t = left.shift()!;
      pts.push(side ? { x: cur.x, y: t.y } : { x: t.x, y: cur.y }, t);
    }
    runs.push({ kind: "piso", points: pts.filter((q, k) => k === 0 || dist(q, pts[k - 1]) > 1), circuit });
  };

  if (electrical && electrical.customerOutlets.length) {
    const id = next("Tomadas 127 V dos clientes (entre as cadeiras)", 127);
    const outs = electrical.customerOutlets.map((o) => ({ x: o.x, y: o.y }));
    electrical.customerOutlets.forEach((o) =>
      devices.push({ x: o.x, y: o.y, kind: "tomada127baixa", circuit: id, wall: o.wall })
    );
    floorRoute(outs, id);
  }

  if (furniture) {
    const id = next("Tomadas 127 V: totem e balcão", 127);
    const pts: PlanXY[] = [center(furniture.totem)];
    devices.push({ ...pts[0], kind: "tomada127media", circuit: id, wall: null, label: "TOTEM" });
    const counter = furniture.premium?.counter;
    if (counter) {
      // Uma tomada por banqueta, na parede atrás do balcão (banquetas a 1/4,
      // 2/4 e 3/4 do comprimento, como no desenho do balcão).
      const wall = furniture.premium!.counterWall;
      const edge = wallPoint(counter, wall);
      const alongX = wall === "top" || wall === "bottom";
      for (let k = 1; k <= COUNTER_SOCKETS; k++) {
        const f = k / (COUNTER_SOCKETS + 1);
        const cp = alongX
          ? { x: counter.x + counter.width * f, y: edge.y }
          : { x: edge.x, y: counter.y + counter.height * f };
        pts.push(cp);
        devices.push({ ...cp, kind: "tomada127media", circuit: id, wall, label: k === 2 ? "BALCÃO" : undefined });
      }
    }
    floorRoute(pts, id);

    const acId = next(`Ar-condicionado split ${layout.acSuggestedBTU.toLocaleString("pt-BR")} BTUs`, 220);
    const ac = furniture.ac;
    const acP = wallPoint(ac, furniture.acWall);
    const nrm = ROOM_NORMAL[furniture.acWall];
    const acIn = { x: acP.x + nrm.x * 60, y: acP.y + nrm.y * 60 };
    devices.push({
      ...acIn,
      kind: "ar",
      circuit: acId,
      wall: furniture.acWall,
      label: `${Math.round(layout.acSuggestedBTU / 1000)}.000 BTUs`,
    });
    // Eletroduto no teto: desce do QD direto pro salão e vai até o aparelho.
    const salonIn = toPlan(panelA, drywallC + FLOOR_ROUTE_MM / 2);
    const bend = side ? { x: salonIn.x, y: acIn.y } : { x: acIn.x, y: salonIn.y };
    runs.push({ kind: "teto", points: [panelOut, salonIn, bend, acIn].filter((q, k, all) => k === 0 || dist(q, all[k - 1]) > 1), circuit: acId });
  }

  return {
    panel,
    lighting: { luminaires, runs: lightRuns, junctions, devices: lightDevices, ledStrip },
    power: { devices, runs },
    circuits,
  };
}
