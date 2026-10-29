import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import { CATALOG_SEED } from "../catalog/seed";
import {
  CUSTOMER_OUTLET_HEIGHT_MM,
  CUSTOMER_OUTLET_VOLTAGE,
  PROFILE_BOTTOM_Y_MM,
  SOCKET_BOX_HALF_HEIGHT_MM,
} from "./electrical";
import type { ProjectState } from "./types";

const base: ProjectState = {
  roomWidthMm: 6000,
  roomDepthMm: 6000,
  orientation: "back",
  ceilingHeightMm: 2800,
  machines: [{ catalogId: "sq-stack", qty: 3 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  totemSide: "left",
  tableSide: "right",
  chairsSide: "left",
  acSide: "left",
  machineWall: "left",
  tableSlot: "farTop",
  chairsSlot: "farTop",
  acSlot: "farBottom",
  counterSide: "right",
  counterSlot: "farBottom",
  acOverrideBTU: null,
};

const layoutFor = (patch: Partial<ProjectState> = {}) => computeLayout({ ...base, ...patch }, CATALOG_SEED).layout!;

describe("elétrica suspensa", () => {
  it("um perfilado de alumínio por maquinário, descendo da eletrocalha sob o forro", () => {
    const layout = layoutFor();
    const e = layout.electrical!;
    expect(e.machines).toHaveLength(3);
    expect(e.trunk.from.y).toBeLessThan(layout.ceilingHeightMm);
    for (const m of e.machines) {
      expect(m.profile.topY).toBeLessThan(e.trunk.from.y); // sai da eletrocalha
      expect(m.profile.topY).toBeGreaterThan(m.profile.bottomY);
      expect(m.profile.bottomY).toBe(PROFILE_BOTTOM_Y_MM);
      // atrás da máquina, dentro da faixa do trecho da eletrocalha
      expect(m.profile.a).toBeGreaterThan(e.trunk.from.a);
      expect(m.profile.a).toBeLessThan(e.trunk.to.a);
    }
    // alimentação vem do forro
    expect(e.feed.toY).toBe(layout.ceilingHeightMm);
  });

  it("tomada Steck 2P+T da secadora no MEIO do perfilado, com a amperagem do disjuntor", () => {
    const sq = layoutFor().electrical!.machines[0];
    const mid = (sq.profile.topY + sq.profile.bottomY) / 2;
    expect(Math.abs(sq.dryerSocket.y - mid)).toBeLessThanOrEqual(1);
    expect(sq.dryerSocket.type).toBe("Steck 2P+T");
    expect(sq.dryerSocket.amperage).toBe(32); // Speed Queen
    const smart = layoutFor({ machines: [{ catalogId: "mamute-smart10", qty: 1 }] }).electrical!.machines[0];
    expect(smart.dryerSocket.amperage).toBe(40); // Smart 10
  });

  it("3 tomadas 220 V VERTICAIS (lavadora e 2 dosadoras) NO perfilado: nada desce além da ponta dele", () => {
    for (const m of layoutFor().electrical!.machines) {
      const { topY, bottomY } = m.profile;
      // conduíte e caixa de tomadas ficam dentro do comprimento do perfilado
      for (const p of m.conduit) {
        expect(p.y).toBeGreaterThanOrEqual(bottomY);
        expect(p.y).toBeLessThanOrEqual(topY);
      }
      expect(m.sockets220.map((s) => s.use)).toEqual(["lavadora", "dosadora-detergente", "dosadora-amaciante"]);
      // uma em cima da outra: mesmo a/c, alturas crescentes (lavadora embaixo)
      expect(new Set(m.sockets220.map((s) => s.a)).size).toBe(1);
      expect(new Set(m.sockets220.map((s) => s.c)).size).toBe(1);
      const ys = m.sockets220.map((s) => s.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
      expect(new Set(ys).size).toBe(3);
      const boxCenter = (ys[0] + ys[2]) / 2;
      expect(boxCenter - SOCKET_BOX_HALF_HEIGHT_MM).toBeGreaterThanOrEqual(bottomY); // caixa inteira acima da ponta
      expect(boxCenter + SOCKET_BOX_HALF_HEIGHT_MM).toBeLessThan(m.dryerSocket.y); // abaixo da Steck da secadora
      // o conduíte chega no topo da caixa
      expect(m.conduit[m.conduit.length - 1].y).toBe(boxCenter + SOCKET_BOX_HALF_HEIGHT_MM)
      expect(m.washerBreakerA).toBe(16); // Speed Queen: disjuntor bipolar de 16 A
    }
  });

  it("não cai no lado do dreno nem do galão: perfilado a 30 cm do centro, fora das bombas", () => {
    const h = layoutFor().hydraulics!;
    layoutFor().electrical!.machines.forEach((m, i) => {
      expect(m.profile.a).toBeLessThan(m.a); // lado oposto ao tubo de dreno (a + 325)
      expect(Math.abs(m.profile.a - h.washers[i].standpipe.a)).toBeGreaterThan(400);
      for (const pump of h.washers[i].dosing.pumps) expect(Math.abs(pump.a - m.profile.a)).toBeGreaterThan(100);
    });
  });

  it("cabo preto da máquina até a tomada da lavadora e plugue Steck macho na tomada da secadora", () => {
    for (const m of layoutFor().electrical!.machines) {
      const back = layoutFor().hydraulics!.washers.find((w) => w.a === m.a)!.dosing.pumps[0].c;
      expect(m.cords.map((cd) => cd.kind)).toEqual(["220", "steck"]);
      const washer = m.cords.find((cd) => cd.kind === "220")!.points;
      const dryer = m.cords.find((cd) => cd.kind === "steck")!.points;
      // começa no plugue (na altura da tomada certa, rente ao perfilado) e termina na traseira da máquina
      expect(washer[0].y).toBe(m.sockets220[0].y);
      expect(washer[0].a).toBe(m.profile.a);
      expect(dryer[0].y).toBe(m.dryerSocket.y);
      expect(dryer[0].a).toBe(m.profile.a);
      for (const cord of [washer, dryer]) {
        expect(cord[0].c).toBeLessThan(m.profile.c); // plugue na face virada pra parede
        expect(cord[cord.length - 1].c).toBe(back);
      }
      // cabo da secadora sai mais alto (secadora em cima no stack)
      expect(dryer[dryer.length - 1].y).toBeGreaterThan(washer[washer.length - 1].y);
    }
  });

  it("só a tomada da máquina fica ligada: as das dosadoras ficam livres", () => {
    for (const m of layoutFor().electrical!.machines) {
      expect(m.cords.filter((cd) => cd.use).map((cd) => cd.use)).toEqual(["lavadora"]);
    }
  });

  it("tomadas 127 V ENTRE as cadeiras, na parede, a 40 cm do piso (caixa dupla por vão)", () => {
    const layout = layoutFor();
    const outlets = layout.electrical!.customerOutlets;
    const chairs = [...layout.furniture!.poufs].sort((p, q) => p.y - q.y || p.x - q.x);
    expect(outlets).toHaveLength(chairs.length - 1);
    for (const [i, o] of outlets.entries()) {
      expect(o.voltage).toBe(CUSTOMER_OUTLET_VOLTAGE);
      expect(o.heightMm).toBe(CUSTOMER_OUTLET_HEIGHT_MM);
      expect(o.mount).toBe("wall");
      expect(o.sockets).toBe(2);
      expect(o.wall).toBe(layout.furniture!.chairsWall);
      // na parede (costas das cadeiras), no vão entre a cadeira i e a i+1 — não atrás delas
      const [p, q] = [chairs[i], chairs[i + 1]];
      expect(o.x).toBe(o.wall === "left" ? p.x : p.x + p.width);
      expect(o.y).toBeGreaterThanOrEqual(p.y + p.height);
      expect(o.y).toBeLessThanOrEqual(q.y);
    }
    expect(layout.electrical!.summary.customerOutlets).toBe(outlets.length * 2);
  });

  it("sem mobiliário não há tomadas dos clientes", () => {
    expect(layoutFor({ furnitureEnabled: false }).electrical!.customerOutlets).toEqual([]);
  });

  it.each([
    ["fileira lateral esquerda", { orientation: "side" as const, machineWall: "left" as const, roomDepthMm: 7000 }],
    ["fileira lateral direita", { orientation: "side" as const, machineWall: "right" as const, roomDepthMm: 7000 }],
  ])("%s: mesma rota no referencial da fileira", (_n, patch) => {
    const e = layoutFor(patch).electrical!;
    expect(e.machines).toHaveLength(3);
    expect(e.summary.customerOutlets).toBe(4); // 2 vãos entre 3 cadeiras, caixa dupla
  });
});

describe("SYC180 e ST055: ponto Steck 3P+T a 1,50 m (pasta maq)", () => {
  const e = () =>
    layoutFor({
      machines: [{ catalogId: "sq-syc180", qty: 1 }, { catalogId: "sq-st055", qty: 1 }],
      ceilingHeightMm: 3000,
      roomWidthMm: 7000,
    }).electrical!;

  it("cada máquina liga num Steck 3P+T 63 A a 1,50 m, sem tomada 220 V própria", () => {
    for (const m of e().machines) {
      expect(m.dryerSocket.type).toBe("Steck 3P+T");
      expect(m.dryerSocket.amperage).toBe(63);
      expect(m.dryerSocket.y).toBe(1500);
      expect(m.sockets220.some((s) => s.use === "lavadora")).toBe(false);
      expect(m.cords.map((c) => c.kind)).toEqual(["steck"]);
    }
  });

  it("lavadora mantém as 2 tomadas das dosadoras; secadora não tem tomada 220 V", () => {
    const lav = e().machines.find((m) => m.catalogId === "sq-syc180")!;
    const sec = e().machines.find((m) => m.catalogId === "sq-st055")!;
    expect(lav.dryerSocket.use).toBe("lavadora");
    expect(lav.washerBreakerA).toBe(63);
    expect(lav.sockets220.map((s) => s.use)).toEqual(["dosadora-detergente", "dosadora-amaciante"]);
    expect(sec.dryerSocket.use).toBe("secadora");
    expect(sec.sockets220).toHaveLength(0);
    expect(e().summary.sockets220).toBe(2);
  });
});
