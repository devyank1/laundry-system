import type { CatalogMachine, FurnitureLayout, Rect, WallSide } from "./types";

// Elétrica das máquinas (Ebook Évora "Stack Elétrica" + fichas Mamute).
// Referencial LOCAL da fileira, em mm: a = ao longo da parede das máquinas,
// c = da parede de trás da área técnica pro salão, y = altura do piso.
//
// Alimentação SUSPENSA, vinda de cima: uma eletrocalha de alumínio corre sob o
// forro, atrás das máquinas, e dela desce um perfilado de alumínio por
// maquinário. No MEIO do perfilado fica a tomada industrial Steck 2P+T da
// secadora (obrigatória, mesma amperagem do disjuntor); mais embaixo, ainda
// NO perfilado (nada desce além da ponta dele), um conduíte curto termina em
// 2 tomadas 220 V: lavadora e bombas dosadoras.
// Mais 3 tomadas 127 V, atrás das cadeiras, pro uso dos clientes.

export const PROFILE_SIZE_MM = 50; // perfilado de alumínio, seção quadrada
export const PROFILE_BOTTOM_Y_MM = 1000; // ponta de baixo do perfilado
export const TRUNK_CEILING_GAP_MM = 150; // eixo da eletrocalha abaixo do forro
export const TRUNK_SIZE_MM = { width: 100, height: 50 };
export const SOCKETS_220_PER_MACHINE = 2; // lavadora + bombas dosadoras
export const SOCKET_BOX_Y_MM = 1100; // caixa das 2 tomadas 220 V: NO perfilado (acima da ponta de baixo)
export const DRYER_PLUG = "Steck 2P+T"; // tomada industrial 3 pinos da secadora
export const DEFAULT_DRYER_BREAKER_A = 32; // Speed Queen: disjuntor e Steck de 32 A
export const CUSTOMER_OUTLETS = 3; // uma por cadeira
export const CUSTOMER_OUTLET_VOLTAGE = 127;
export const CUSTOMER_OUTLET_HEIGHT_MM = 400;

const PROFILE_OFFSET_MM = -300; // do centro da máquina (lado oposto ao dreno)
const PROFILE_BEHIND_MACHINE_MM = 50;
const TRUNK_END_MARGIN_MM = 150;
const CONDUIT_START_Y_MM = 1300; // conduíte entra no perfilado e desce até a caixa de tomadas
const CONDUIT_FACE_OFFSET_MM = 36; // conduíte rente à face do perfilado (lado da parede)

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
  // Conduíte curto, rente ao perfilado, até as 2 tomadas 220 V (lavadora, dosadoras).
  conduit: ElectricalPoint[];
  sockets220: { a: number; c: number; y: number; use: "lavadora" | "dosadoras" }[];
  washerBreakerA: number | null;
}

export interface CustomerOutlet {
  x: number; // plano da planta (mm)
  y: number;
  wall: WallSide; // parede em que a tomada está (as costas da cadeira)
  heightMm: number;
  voltage: number;
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

  const perMachine: MachineElectrical[] = items.map(({ m, a }) => {
    const pa = a + PROFILE_OFFSET_MM;
    const midY = Math.round((topY + PROFILE_BOTTOM_Y_MM) / 2);
    const boxY = SOCKET_BOX_Y_MM;
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
        { a: pa, c: cProfile - CONDUIT_FACE_OFFSET_MM, y: boxY + 45 },
      ],
      sockets220: [
        { a: pa - 28, c: cProfile, y: boxY, use: "lavadora" as const },
        { a: pa + 28, c: cProfile, y: boxY, use: "dosadoras" as const },
      ],
      washerBreakerA: m.type === "secadora" ? null : (m.breakerLavadoraA ?? null),
    };
  });

  // A eletrocalha vai de uma ponta à outra dos perfilados, e a descida do
  // forro fica na ponta da porta técnica (a mesma ponta oposta à saída da exaustão).
  const aList = perMachine.map((p) => p.profile.a);
  const aMin = Math.min(...aList) - TRUNK_END_MARGIN_MM;
  const aMax = Math.max(...aList) + TRUNK_END_MARGIN_MM;
  const feedA = input.techAccessSide === "right" ? aMax : aMin;

  // Tomadas 127 V: uma atrás de cada cadeira, na parede em que ela encosta. Se
  // a cadeira está de costas pro drywall (fileira ao lado da mesa), usa a
  // parede lateral mais próxima.
  const customerOutlets: CustomerOutlet[] = [];
  if (input.furniture) {
    const { poufs, chairsWall } = input.furniture;
    for (const p of poufs.slice(0, CUSTOMER_OUTLETS)) {
      const wall: WallSide =
        chairsWall === "left" || chairsWall === "right"
          ? chairsWall
          : p.x + p.width / 2 < input.roomWidthMm / 2
            ? "left"
            : "right";
      const pt = wall === chairsWall ? wallPoint(p, wall) : { x: wall === "left" ? 0 : input.roomWidthMm, y: p.y + p.height / 2 };
      customerOutlets.push({ ...pt, wall, heightMm: CUSTOMER_OUTLET_HEIGHT_MM, voltage: CUSTOMER_OUTLET_VOLTAGE });
    }
  }

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
      customerOutlets: customerOutlets.length,
    },
  };
}
