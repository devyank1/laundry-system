import type { CatalogMachine, FurnitureLayout, Rect, WallSide } from "./types";

// Elétrica das máquinas (Ebook Évora "Stack Elétrica" + fichas Mamute).
// Referencial LOCAL da fileira, em mm: a = ao longo da parede das máquinas,
// c = da parede de trás da área técnica pro salão, y = altura do piso.
//
// Alimentação SUSPENSA, vinda de cima: uma eletrocalha de alumínio corre sob o
// forro, atrás das máquinas, e dela desce um perfilado de alumínio por
// maquinário. No MEIO do perfilado fica a tomada industrial Steck 2P+T da
// secadora (obrigatória, mesma amperagem do disjuntor); mais embaixo, ainda
// NO perfilado (nada desce além da ponta dele), um conduíte curto termina
// numa caixa VERTICAL com 3 tomadas 220 V, uma em cima da outra: lavadora
// (embaixo) e as 2 bombas dosadoras. Cabos pretos saem da máquina até a
// tomada da lavadora e, com um plugue Steck macho, até a Steck da secadora.
// Tomadas 127 V dos clientes ENTRE as cadeiras (caixa dupla, vertical).

export const PROFILE_SIZE_MM = 50; // perfilado de alumínio, seção quadrada
export const PROFILE_BOTTOM_Y_MM = 1000; // ponta de baixo do perfilado
export const TRUNK_CEILING_GAP_MM = 150; // eixo da eletrocalha abaixo do forro
export const TRUNK_SIZE_MM = { width: 100, height: 50 };
export const SOCKETS_220_PER_MACHINE = 3; // lavadora + 2 bombas dosadoras
export const SOCKET_BOX_Y_MM = 1110; // centro da caixa vertical das 3 tomadas 220 V, NO perfilado
export const SOCKET_SPACING_MM = 60; // entre as tomadas da caixa vertical
export const SOCKET_BOX_HALF_HEIGHT_MM = 100; // caixa: 20 cm de altura
export const DRYER_PLUG = "Steck 2P+T"; // tomada industrial 3 pinos da secadora
export const DEFAULT_DRYER_BREAKER_A = 32; // Speed Queen: disjuntor e Steck de 32 A
export const CUSTOMER_SOCKETS_PER_BOX = 2; // caixa dupla vertical em cada vão entre cadeiras
export const CUSTOMER_OUTLET_VOLTAGE = 127;
export const CUSTOMER_OUTLET_HEIGHT_MM = 400;

const PROFILE_OFFSET_MM = -300; // do centro da máquina (lado oposto ao dreno)
const PROFILE_BEHIND_MACHINE_MM = 50;
const TRUNK_END_MARGIN_MM = 150;
const CONDUIT_START_Y_MM = 1400; // conduíte entra no perfilado e desce até a caixa de tomadas
const CONDUIT_FACE_OFFSET_MM = 36; // conduíte rente à face do perfilado (lado da parede)
// Tomadas viradas pra parede de trás (lado do técnico): o plugue sai da face
// e o cabo sai da ponta dele. Distâncias (mm) do eixo do perfilado, rumo à parede.
export const PLUG_220_END_MM = 100;
export const STECK_PLUG_END_MM = 145;
const WASHER_CORD_A_MM = 0; // saída do cabo na traseira: entre as bombas dosadoras, abaixo delas
const DRYER_CORD_A_MM = -230;
const WASHER_CORD_Y_MM = 850; // lavadora: embaixo do stack
const DRYER_CORD_Y_MM = 1650; // secadora: em cima

export interface ElectricalPoint {
  a: number;
  c: number;
  y: number;
}

export interface MachineElectrical {
  catalogId: string;
  a: number; // centro da máquina
  // Perfilado de alumínio descendo da eletrocalha.
  profile: { a: number; c: number; topY: number; bottomY: number; sizeMm: number };
  // Tomada Steck da secadora, no meio do perfilado.
  dryerSocket: { a: number; c: number; y: number; type: string; amperage: number | null };
  // Conduíte curto, rente ao perfilado, até a caixa vertical das 3 tomadas 220 V.
  conduit: ElectricalPoint[];
  sockets220: { a: number; c: number; y: number; use: Socket220Use }[];
  washerBreakerA: number | null;
  // Cabos pretos soltos da MÁQUINA, do plugue até a traseira dela: "220" na
  // tomada da lavadora (a de baixo; as das dosadoras ficam livres) e "steck"
  // com plugue Steck macho na tomada da secadora.
  cords: { kind: "220" | "steck"; use?: Socket220Use; points: ElectricalPoint[] }[];
}

export type Socket220Use = "lavadora" | "dosadora-detergente" | "dosadora-amaciante";

export interface CustomerOutlet {
  x: number; // plano da planta (mm)
  y: number;
  // Na parede, no vão entre duas cadeiras encostadas nela; sem parede atrás
  // das cadeiras, caixa de piso no vão.
  mount: "wall" | "floor";
  wall: WallSide | null;
  heightMm: number;
  voltage: number;
  sockets: number;
}

export interface ElectricalLayout {
  // Eletrocalha de alumínio sob o forro, atrás das máquinas.
  trunk: { from: ElectricalPoint; to: ElectricalPoint; widthMm: number; heightMm: number };
  // Descida da alimentação, vinda do forro, na ponta junto da porta técnica.
  feed: { a: number; c: number; fromY: number; toY: number };
  machines: MachineElectrical[];
  customerOutlets: CustomerOutlet[];
  summary: { machines: number; dryerSockets: number; sockets220: number; customerOutlets: number };
}

export interface ElectricalInput {
  machines: CatalogMachine[];
  alongStarts: number[];
  drywallAcrossMm: number;
  ceilingMm: number;
  techAccessSide: "left" | "right";
  furniture: FurnitureLayout | null;
  roomWidthMm: number;
}

// Ponto da parede, no plano, atrás de uma cadeira (peça encostada na parede).
function wallPoint(r: Rect, wall: WallSide): { x: number; y: number } {
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

const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// Tomadas 127 V ENTRE as cadeiras: uma caixa dupla em cada vão. Cadeiras de
// costas pra uma parede lateral, ou pra parede de cima da planta, deixam a
// caixa na parede; senão (fileira solta no salão), caixa de piso no vão.
function customerOutletsFor(furniture: FurnitureLayout | null): CustomerOutlet[] {
  if (!furniture || furniture.poufs.length < 2) return [];
  const { poufs, chairsWall } = furniture;
  const sorted = [...poufs].sort((p, q) => center(p).x - center(q).x || center(p).y - center(q).y);
  const onWall =
    chairsWall === "left" ||
    chairsWall === "right" ||
    (chairsWall === "top" && sorted.every((p) => p.y === 0));
  const out: CustomerOutlet[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const [p, q] = [sorted[i - 1], sorted[i]];
    const pt = onWall
      ? (() => {
          const a = wallPoint(p, chairsWall);
          const b = wallPoint(q, chairsWall);
          return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        })()
      : { x: (center(p).x + center(q).x) / 2, y: (center(p).y + center(q).y) / 2 };
    out.push({
      ...pt,
      mount: onWall ? "wall" : "floor",
      wall: onWall ? chairsWall : null,
      heightMm: onWall ? CUSTOMER_OUTLET_HEIGHT_MM : 0,
      voltage: CUSTOMER_OUTLET_VOLTAGE,
      sockets: CUSTOMER_SOCKETS_PER_BOX,
    });
  }
  return out;
}

export function computeElectrical(input: ElectricalInput): ElectricalLayout | null {
  const { machines, alongStarts, drywallAcrossMm, ceilingMm } = input;
  if (machines.length === 0) return null;

  const items = machines.map((m, i) => ({
    m,
    a: alongStarts[i] + m.widthMm / 2,
    back: drywallAcrossMm - m.depthMm,
  }));
  const backMin = Math.min(...items.map((x) => x.back));
  const cProfile = backMin - PROFILE_BEHIND_MACHINE_MM;
  const trunkY = ceilingMm - TRUNK_CEILING_GAP_MM;
  const topY = trunkY - TRUNK_SIZE_MM.height / 2;

  const perMachine: MachineElectrical[] = items.map(({ m, a, back }) => {
    const pa = a + PROFILE_OFFSET_MM;
    const midY = Math.round((topY + PROFILE_BOTTOM_Y_MM) / 2);
    const boxY = SOCKET_BOX_Y_MM;
    // Caixa vertical: lavadora embaixo (o cabo dela desce livre), dosadoras em cima.
    const uses: Socket220Use[] = ["lavadora", "dosadora-detergente", "dosadora-amaciante"];
    const sockets220 = uses.map((use, k) => ({
      a: pa,
      c: cProfile,
      y: boxY + (k - 1) * SOCKET_SPACING_MM,
      use,
    }));
    // Cabo solto: direto da ponta do plugue até a traseira da máquina (o 3D
    // desenha a barriga do peso do fio, sem rota em degraus).
    const cord = (endMm: number, socketY: number, aOffset: number, machineY: number) => [
      { a: pa, c: cProfile - endMm, y: socketY },
      { a: a + aOffset, c: back, y: machineY },
    ];
    const hasDryer = m.type !== "lavadora";
    const hasWasher = m.type !== "secadora";
    const cords: MachineElectrical["cords"] = [];
    if (hasWasher) {
      cords.push({
        kind: "220",
        use: "lavadora",
        points: cord(PLUG_220_END_MM, sockets220[0].y, WASHER_CORD_A_MM, WASHER_CORD_Y_MM),
      });
    }
    if (hasDryer) {
      cords.push({ kind: "steck", points: cord(STECK_PLUG_END_MM, midY, DRYER_CORD_A_MM, DRYER_CORD_Y_MM) });
    }
    return {
      catalogId: m.id,
      a,
      profile: { a: pa, c: cProfile, topY, bottomY: PROFILE_BOTTOM_Y_MM, sizeMm: PROFILE_SIZE_MM },
      dryerSocket: {
        a: pa,
        c: cProfile,
        y: midY,
        type: DRYER_PLUG,
        amperage: m.type === "lavadora" ? null : (m.breakerSecadoraA ?? DEFAULT_DRYER_BREAKER_A),
      },
      conduit: [
        { a: pa, c: cProfile - CONDUIT_FACE_OFFSET_MM, y: CONDUIT_START_Y_MM },
        { a: pa, c: cProfile - CONDUIT_FACE_OFFSET_MM, y: (CONDUIT_START_Y_MM + boxY) / 2 },
        { a: pa, c: cProfile - CONDUIT_FACE_OFFSET_MM, y: boxY + SOCKET_BOX_HALF_HEIGHT_MM },
      ],
      sockets220,
      washerBreakerA: m.type === "secadora" ? null : (m.breakerLavadoraA ?? null),
      cords,
    };
  });

  // A eletrocalha vai de uma ponta à outra dos perfilados, e a descida do
  // forro fica na ponta da porta técnica (a mesma ponta oposta à saída da exaustão).
  const aList = perMachine.map((p) => p.profile.a);
  const aMin = Math.min(...aList) - TRUNK_END_MARGIN_MM;
  const aMax = Math.max(...aList) + TRUNK_END_MARGIN_MM;
  const feedA = input.techAccessSide === "right" ? aMax : aMin;

  const customerOutlets = customerOutletsFor(input.furniture);

  return {
    trunk: {
      from: { a: aMin, c: cProfile, y: trunkY },
      to: { a: aMax, c: cProfile, y: trunkY },
      widthMm: TRUNK_SIZE_MM.width,
      heightMm: TRUNK_SIZE_MM.height,
    },
    feed: { a: feedA, c: cProfile, fromY: trunkY + TRUNK_SIZE_MM.height / 2, toY: ceilingMm },
    machines: perMachine,
    customerOutlets,
    summary: {
      machines: perMachine.length,
      dryerSockets: perMachine.filter((p) => p.dryerSocket.amperage !== null).length,
      sockets220: perMachine.length * SOCKETS_220_PER_MACHINE,
      customerOutlets: customerOutlets.reduce((n, o) => n + o.sockets, 0),
    },
  };
}
