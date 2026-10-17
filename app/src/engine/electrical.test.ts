import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import { CATALOG_SEED } from "../catalog/seed";
import {
  CUSTOMER_OUTLET_HEIGHT_MM,
  CUSTOMER_OUTLET_VOLTAGE,
  PROFILE_BOTTOM_Y_MM,
  SOCKET_BOX_Y_MM,
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

  it("2 tomadas 220 V (lavadora e dosadoras) NO perfilado: nada desce além da ponta dele", () => {
    for (const m of layoutFor().electrical!.machines) {
      const { topY, bottomY } = m.profile;
      // conduíte e caixa de tomadas ficam dentro do comprimento do perfilado
      for (const p of m.conduit) {
        expect(p.y).toBeGreaterThanOrEqual(bottomY);
        expect(p.y).toBeLessThanOrEqual(topY);
      }
      expect(m.sockets220.map((s) => s.use)).toEqual(["lavadora", "dosadoras"]);
      for (const s of m.sockets220) {
        expect(s.y).toBe(SOCKET_BOX_Y_MM);
        expect(s.y - 40).toBeGreaterThanOrEqual(bottomY); // a caixa inteira acima da ponta de baixo
        expect(s.y).toBeLessThan(m.dryerSocket.y); // abaixo da Steck da secadora
      }
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

  it("3 tomadas 127 V atrás das cadeiras, na parede, a 40 cm do piso", () => {
    const layout = layoutFor();
    const outlets = layout.electrical!.customerOutlets;
    expect(outlets).toHaveLength(3);
    for (const [i, o] of outlets.entries()) {
      expect(o.voltage).toBe(CUSTOMER_OUTLET_VOLTAGE);
      expect(o.heightMm).toBe(CUSTOMER_OUTLET_HEIGHT_MM);
      const chair = layout.furniture!.poufs[i];
      expect(o.wall).toBe(layout.furniture!.chairsWall);
      // na parede (borda da cadeira) e alinhada com ela
      expect(o.x).toBe(o.wall === "left" ? chair.x : chair.x + chair.width);
      expect(o.y).toBeCloseTo(chair.y + chair.height / 2);
    }
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
    expect(e.summary.customerOutlets).toBe(3);
  });
});
