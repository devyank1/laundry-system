import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import type { CatalogMachine, ProjectState } from "./types";

const catalog: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
  },
];

const validState: ProjectState = {
  roomWidthMm: 5000,
  roomDepthMm: 5500, // dá espaço pra fileira mesa+2 cadeiras encostada na parede (~3,0m)
  orientation: "back",
  ceilingHeightMm: 2400,
  machines: [{ catalogId: "sq-stack", qty: 3 }],
  doorEnabled: true,
  techAccessSide: "right",
  furnitureEnabled: true,
  totemSide: "left",
  tableSide: "left",
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

describe("computeLayout", () => {
  it("retorna layout null e violações quando a sala é pequena demais", () => {
    const result = computeLayout({ ...validState, roomWidthMm: 1000 }, catalog);
    expect(result.layout).toBeNull();
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("posiciona uma máquina por instância, sem sobreposição, dentro da sala", () => {
    const result = computeLayout(validState, catalog);
    expect(result.violations).toEqual([]);
    expect(result.layout).not.toBeNull();
    const placed = result.layout!.machines;
    expect(placed).toHaveLength(3);
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i].x).toBeGreaterThanOrEqual(placed[i - 1].x + placed[i - 1].widthMm);
    }
    for (const m of placed) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x + m.widthMm).toBeLessThanOrEqual(validState.roomWidthMm);
    }
  });

  it("gera um vão de drywall por máquina posicionada", () => {
    const result = computeLayout(validState, catalog);
    expect(result.layout!.drywall.openings).toHaveLength(3);
  });

  it("deixa o corredor técnico do lado escolhido (right = encostado na parede direita)", () => {
    const result = computeLayout(validState, catalog);
    const corridor = result.layout!.techCorridor;
    expect(corridor.x).toBe(validState.roomWidthMm - 700);
    expect(corridor.width).toBe(700);
  });

  it("começa a fileira a 500mm da parede do lado oposto à porta técnica", () => {
    const right = computeLayout(validState, catalog).layout!;
    expect(right.machines[0].x).toBe(500);

    const left = computeLayout({ ...validState, techAccessSide: "left" }, catalog).layout!;
    const last = left.machines[left.machines.length - 1];
    expect(last.x + last.widthMm).toBe(validState.roomWidthMm - 500);
  });

  it("coloca a porta técnica de 70cm no drywall, no corredor técnico", () => {
    const layout = computeLayout(validState, catalog).layout!;
    expect(layout.techDoor).toEqual({
      x: validState.roomWidthMm - 700,
      y: layout.drywall.y,
      width: 700,
      height: 0,
    });
  });

  it("deixa o corredor técnico do lado esquerdo quando techAccessSide=left", () => {
    const result = computeLayout({ ...validState, techAccessSide: "left" }, catalog);
    const corridor = result.layout!.techCorridor;
    expect(corridor.x).toBe(0);
  });

  it("inclui mobiliário quando furnitureEnabled=true", () => {
    const result = computeLayout(validState, catalog);
    expect(result.layout!.furniture).not.toBeNull();
    expect(result.layout!.furniture!.poufs).toHaveLength(3);
  });

  it("usa 3 cadeiras quadradas de 42cm, em fileira logo depois da mesa", () => {
    const furniture = computeLayout(validState, catalog).layout!.furniture!;
    const [chair1, chair2, chair3] = furniture.poufs;
    expect(furniture.poufs).toHaveLength(3);
    for (const c of furniture.poufs) {
      expect(c.width).toBe(420);
      expect(c.height).toBe(420);
    }
    // encostadas na mesma parede da mesa (tableSide="left" → x=0), uma logo
    // depois da outra em y, continuando a fileira a partir da mesa
    expect(chair1.x).toBe(0);
    expect(chair1.y).toBe(furniture.table.y + furniture.table.height + 100);
    expect(chair2.x).toBe(0);
    expect(chair2.y).toBe(chair1.y + 420 + 100);
    expect(chair3.x).toBe(0);
    expect(chair3.y).toBe(chair2.y + 420 + 100);
  });

  it("embute o totem no seu próprio trecho de 50cm, quando totemSide é OPOSTO à porta técnica", () => {
    // validState: techAccessSide="right", totemSide="left" (lados opostos)
    // → o totem usa a faixa de 50cm inteira da esquerda, livre do corredor.
    const layout = computeLayout(validState, catalog).layout!;
    const totem = layout.furniture!.totem;
    expect(totem.y).toBe(layout.drywall.y);
    expect(totem.width).toBe(400);
    expect(totem.x).toBe((500 - 400) / 2); // centralizado na faixa [0, 500]
    expect(totem.x + totem.width).toBeLessThanOrEqual(500);

    // mesmo com techAccessSide="left", enquanto totemSide continuar "right"
    // (oposto), o totem usa a faixa inteira de 50cm da direita
    const left = computeLayout(
      { ...validState, techAccessSide: "left", totemSide: "right" },
      catalog
    ).layout!;
    const leftTotem = left.furniture!.totem;
    const leftStripX = left.roomWidthMm - 500; // faixa [roomWidth-500, roomWidth] do lado direito
    expect(leftTotem.x).toBe(leftStripX + (500 - 400) / 2);
    expect(leftTotem.x).toBeGreaterThanOrEqual(leftStripX);
  });

  it("quando totemSide é o MESMO lado da porta técnica, o totem encosta logo antes do vão do corredor", () => {
    const layout = computeLayout(
      { ...validState, techAccessSide: "right", totemSide: "right" },
      catalog
    ).layout!;
    const totem = layout.furniture!.totem;
    // faixa do totem fica logo à esquerda do corredor (que tem 700mm,
    // encostado na parede direita), sem sobrepor
    const expectedStripX = validState.roomWidthMm - 700 - 500;
    expect(totem.x).toBe(expectedStripX + (500 - 400) / 2);
    expect(totem.x + totem.width).toBeLessThanOrEqual(layout.techCorridor.x);
  });

  it("encosta a mesa na parede perto das máquinas (início do salão), lado escolhido (tableSide)", () => {
    const layout = computeLayout(validState, catalog).layout!; // tableSide/acSide: "left"
    const { ac, acWall, table } = layout.furniture!;
    const salonFrontY = layout.drywall.y + 100;
    const salonCenter = (salonFrontY + validState.roomDepthMm) / 2;

    expect(acWall).toBe("left");
    expect(ac.x).toBe(0);
    expect(ac.y + ac.height / 2).toBeCloseTo(salonCenter, 0);

    // mesa virada (2m de comprimento entrando sala adentro, perpendicular à
    // parede esquerda), a 1,00m da frente da máquina (linha do drywall) pra
    // trânsito de pessoas — não mais centralizada nem colada no salão
    expect(table.x).toBe(0);
    expect(table.y).toBe(layout.drywall.y + 1000);
    expect(table.width).toBe(2000);
    expect(table.height).toBe(800);

    const right = computeLayout(
      { ...validState, tableSide: "right", acSide: "right" },
      catalog
    ).layout!;
    expect(right.furniture!.acWall).toBe("right");
    expect(right.furniture!.ac.x + right.furniture!.ac.width).toBe(validState.roomWidthMm);
    expect(right.furniture!.table.x + right.furniture!.table.width).toBe(validState.roomWidthMm);
    expect(right.furniture!.table.y).toBe(right.drywall.y + 1000);
  });

  it("cada item de mobiliário pode ir pra um lado diferente, de forma independente", () => {
    // totem na esquerda, mesa+cadeiras na direita, AC na esquerda — tudo junto
    const mixed = computeLayout(
      {
        ...validState,
        totemSide: "left",
        tableSide: "right",
        chairsSide: "right",
        acSide: "left",
      },
      catalog
    ).layout!.furniture!;

    expect(mixed.totem.x).toBeLessThan(500); // lado esquerdo
    expect(mixed.table.x + mixed.table.width).toBe(validState.roomWidthMm); // encostada na direita
    expect(mixed.poufs[0].x + mixed.poufs[0].width).toBe(validState.roomWidthMm); // cadeiras também na direita
    expect(mixed.ac.x).toBe(0); // AC na esquerda, junto com o totem
    expect(mixed.acWall).toBe("left");
  });

  it("cadeiras começam do zero (1,00m da máquina) quando ficam num lado diferente da mesa", () => {
    const layout = computeLayout(
      { ...validState, tableSide: "left", chairsSide: "right" },
      catalog
    ).layout!;
    const firstChair = layout.furniture!.poufs[0];
    expect(firstChair.x + firstChair.width).toBe(validState.roomWidthMm); // lado direito
    expect(firstChair.y).toBe(layout.drywall.y + 1000); // não depende da mesa, que está na esquerda
  });

  it("cadeiras viram fileira ao lado da mesa quando a coluna não cabe até a frente", () => {
    // 4,5m de fundo: coluna depois da mesa passaria da parede da frente
    const s = { ...validState, roomDepthMm: 4500 };
    const f = computeLayout(s, catalog).layout!.furniture!;
    for (const c of f.poufs) {
      expect(c.y + c.height).toBeLessThanOrEqual(s.roomDepthMm);
      expect(c.x + c.width).toBeLessThanOrEqual(s.roomWidthMm);
    }
    expect(f.poufs[0].x).toBe(f.table.x + f.table.width + 100);
  });

  it("omite mobiliário quando furnitureEnabled=false", () => {
    const result = computeLayout({ ...validState, furnitureEnabled: false }, catalog);
    expect(result.layout!.furniture).toBeNull();
  });

  it("sugere BTU pela fórmula quando não há override", () => {
    const result = computeLayout(validState, catalog);
    const areaM2 = result.layout!.salonAreaM2;
    expect(result.layout!.acSuggestedBTU).toBeGreaterThan(0);
    expect(result.layout!.acSuggestedBTU).toBeGreaterThanOrEqual(areaM2 * 600);
  });

  it("calcula o BTU só pela área social (sem a área técnica atrás do drywall)", () => {
    const layout = computeLayout(validState, catalog).layout!;
    // salão = fundo da sala − (área técnica 1,05m + máquina 0,794m + drywall 0,10m)
    const salonDepthM = (validState.roomDepthMm - (1050 + 794 + 100)) / 1000;
    expect(layout.salonAreaM2).toBeCloseTo((validState.roomWidthMm / 1000) * salonDepthM, 5);

    const side = computeLayout({ ...validState, orientation: "side" }, catalog).layout!;
    const sideSalonM = (validState.roomWidthMm - (1050 + 794 + 100)) / 1000;
    expect(side.salonAreaM2).toBeCloseTo((validState.roomDepthMm / 1000) * sideSalonM, 5);

    // 5,0 x 3,556 = 17,8m² social, 3 secadoras: 17,8*600 + 6000 = 16.668 → 18.000
    // (pela área total, 27,5m², daria 22.500 → 30.000)
    expect(layout.acSuggestedBTU).toBe(18000);
  });

  it("usa o override de BTU quando informado", () => {
    const result = computeLayout({ ...validState, acOverrideBTU: 36000 }, catalog);
    expect(result.layout!.acSuggestedBTU).toBe(36000);
  });

  it("inclui a porta frontal centralizada quando doorEnabled=true", () => {
    const result = computeLayout(validState, catalog);
    const door = result.layout!.frontDoor;
    expect(door).not.toBeNull();
    expect(door!.x + door!.width / 2).toBeCloseTo(validState.roomWidthMm / 2, 0);
    expect(door!.y).toBe(validState.roomDepthMm);
  });

  it("omite a porta frontal quando doorEnabled=false", () => {
    const result = computeLayout({ ...validState, doorEnabled: false }, catalog);
    expect(result.layout!.frontDoor).toBeNull();
  });

  it("alinha a face frontal de cada máquina com a linha do drywall", () => {
    const result = computeLayout(validState, catalog);
    for (const m of result.layout!.machines) {
      expect(m.y + m.depthMm).toBe(result.layout!.drywall.y);
    }
  });
});

describe("base de concreto da máquina pesada", () => {
  it("máquina de 400 kg ou mais fica sobre base de concreto de 2 cm; as leves, direto no piso", () => {
    const heavy: CatalogMachine = { ...catalog[0], id: "pesada", weightKg: 615, widthMm: 835, depthMm: 1190, heightMm: 2210 };
    const layout = computeLayout(
      { ...validState, roomWidthMm: 7000, roomDepthMm: 6000, ceilingHeightMm: 2800, machines: [{ catalogId: "sq-stack", qty: 1 }, { catalogId: "pesada", qty: 1 }] },
      [...catalog, heavy]
    ).layout!;
    expect(layout.machines.find((m) => m.catalogId === "pesada")!.baseMm).toBe(20);
    expect(layout.machines.find((m) => m.catalogId === "sq-stack")!.baseMm).toBe(0);
  });
});

describe("computeLayout — orientation=side (fileira na parede lateral)", () => {
  const sideState: ProjectState = { ...validState, orientation: "side" };

  it("a fileira corre ao longo de roomDepthMm, não mais roomWidthMm", () => {
    const layout = computeLayout(sideState, catalog).layout!;
    // todas as máquinas ficam na mesma posição "across" (x constante, perto
    // da parede lateral), e se espalham em y (que agora é o eixo da fileira)
    const xs = new Set(layout.machines.map((m) => m.x));
    expect(xs.size).toBe(1); // mesma profundidade (794mm), mesmo x
    const ys = layout.machines.map((m) => m.y).sort((a, b) => a - b);
    expect(ys[0]).toBe(500); // LATERAL_CLEARANCE_MM, igual ao back mode (só no outro eixo)
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    }
    // toda a fileira cabe dentro de roomDepthMm (o eixo "along" agora) —
    // usa a largura real do catálogo (683mm), não `last.widthMm` (que já
    // foi trocada de eixo e virou a extensão "across" = profundidade)
    const last = layout.machines[layout.machines.length - 1];
    expect(last.y + 683).toBeLessThanOrEqual(sideState.roomDepthMm);
  });

  it("a face frontal de cada máquina (agora em x) alinha com a linha do drywall", () => {
    const layout = computeLayout(sideState, catalog).layout!;
    for (const m of layout.machines) {
      // em orientation=side, widthMm é quem virou a extensão "across"
      // (profundidade real da máquina) — depthMm virou a extensão "along".
      expect(m.x + m.widthMm).toBe(layout.drywall.y);
    }
  });

  it("widthMm/depthMm das máquinas trocam de eixo (a máquina gira junto)", () => {
    const back = computeLayout(validState, catalog).layout!.machines[0];
    const side = computeLayout(sideState, catalog).layout!.machines[0];
    expect(side.widthMm).toBe(back.depthMm);
    expect(side.depthMm).toBe(back.widthMm);
    expect(side.heightMm).toBe(back.heightMm); // altura nunca gira
  });

  it("corredor técnico e porta técnica ficam na parede lateral (across=0), ao longo de roomDepthMm", () => {
    const layout = computeLayout(sideState, catalog).layout!;
    expect(layout.techCorridor.x).toBe(0);
    expect(layout.techCorridor.width).toBe(layout.drywall.y); // da parede de fundo até o drywall
    expect(layout.techCorridor.height).toBe(700); // TECH_DOOR_WIDTH_MM, agora em Y
    expect(layout.techCorridor.y).toBe(sideState.roomDepthMm - 700); // techAccessSide="right" = fim do eixo along
    expect(layout.techDoor.y).toBe(sideState.roomDepthMm - 700);
  });

  it("mesa em 'farTop' encosta na parede oposta às máquinas, em cima, girada 90°", () => {
    const layout = computeLayout(sideState, catalog).layout!;
    const f = layout.furniture!;
    expect(f.table.y).toBe(0);
    expect(f.table.x + f.table.width).toBe(sideState.roomWidthMm);
    expect(f.table.width).toBe(800); // TABLE_DEPTH_MM e TABLE_WIDTH_MM trocaram de eixo
    expect(f.table.height).toBe(2000);
  });

  it("mesa em 'farBottom' fica embaixo e em 'near' fica a 1,00m da frente das máquinas", () => {
    const bottom = computeLayout({ ...sideState, tableSlot: "farBottom" }, catalog).layout!;
    expect(bottom.furniture!.table.y + bottom.furniture!.table.height).toBe(sideState.roomDepthMm);
    expect(bottom.furniture!.table.x + bottom.furniture!.table.width).toBe(sideState.roomWidthMm);

    const near = computeLayout({ ...sideState, tableSlot: "near" }, catalog).layout!;
    expect(near.furniture!.table.x).toBe(near.drywall.y + 1000);
  });

  it("machineWall='right' espelha a planta: máquinas na parede direita, mobiliário 'far' na esquerda", () => {
    const layout = computeLayout({ ...sideState, machineWall: "right" }, catalog).layout!;
    expect(layout.machineWall).toBe("right");
    for (const m of layout.machines) {
      // costas da máquina a 1,05m (área técnica) da parede direita
      expect(m.x).toBe(sideState.roomWidthMm - layout.drywall.y);
      expect(sideState.roomWidthMm - (m.x + m.widthMm)).toBe(1050);
    }
    expect(layout.techCorridor.x + layout.techCorridor.width).toBe(sideState.roomWidthMm);
    expect(layout.furniture!.table.x).toBe(0);
    expect(layout.furniture!.acWall).toBe("left"); // acSlot="farBottom" → parede oposta
  });

  it("totem fica sempre colado na primeira ou na última máquina da fileira", () => {
    for (const techAccessSide of ["left", "right"] as const) {
      const first = computeLayout({ ...sideState, techAccessSide, totemSide: "left" }, catalog)
        .layout!;
      const m1 = first.machines[0];
      const t1 = first.furniture!.totem;
      expect(t1.y + t1.height).toBeLessThanOrEqual(m1.y);
      expect(m1.y - (t1.y + t1.height)).toBeLessThan(100);

      const last = computeLayout({ ...sideState, techAccessSide, totemSide: "right" }, catalog)
        .layout!;
      const mN = last.machines[last.machines.length - 1];
      const tN = last.furniture!.totem;
      expect(tN.y).toBeGreaterThanOrEqual(mN.y + mN.depthMm);
      expect(tN.y - (mN.y + mN.depthMm)).toBeLessThan(100);
    }
  });

  it("cadeiras 'near' encostam no drywall livre ao lado das máquinas, com o AC em cima delas", () => {
    for (const machineWall of ["left", "right"] as const) {
      const s = {
        ...sideState,
        roomDepthMm: 6000,
        machineWall,
        tableSlot: "farTop" as const,
        chairsSlot: "near" as const,
        acSlot: "near" as const,
      };
      const layout = computeLayout(s, catalog).layout!;
      const f = layout.furniture!;
      const drywallFaceX =
        machineWall === "left" ? layout.drywall.y + 100 : s.roomWidthMm - layout.drywall.y - 100;
      const lastMachine = layout.machines[layout.machines.length - 1];
      for (const c of f.poufs) {
        // encostada na face do drywall
        expect(machineWall === "left" ? c.x : c.x + c.width).toBe(drywallFaceX);
        // sem invadir máquinas, totem ou corredor técnico
        expect(c.y).toBeGreaterThanOrEqual(lastMachine.y + lastMachine.depthMm);
        expect(c.y + c.height).toBeLessThanOrEqual(layout.techCorridor.y);
      }
      // AC na mesma parede, em cima das cadeiras, mas a ≥60cm da última máquina
      expect(machineWall === "left" ? f.ac.x : f.ac.x + f.ac.width).toBe(drywallFaceX);
      expect(f.ac.y).toBeGreaterThanOrEqual(f.poufs[0].y);
      expect(f.ac.y + f.ac.height).toBeLessThanOrEqual(f.poufs[2].y + f.poufs[2].height);
      expect(f.ac.y - (lastMachine.y + lastMachine.depthMm)).toBeGreaterThanOrEqual(600);
    }
  });

  it("sem drywall livre, cadeiras 'near' vão pra parede de topo, com o AC junto", () => {
    // fileira enche o drywall: 6 máquinas em 6,0m (500 + 6*683+5*20 + 700 = 5,40m)
    const s = {
      ...sideState,
      roomDepthMm: 6000,
      machines: [{ catalogId: "sq-stack", qty: 6 }],
      chairsSlot: "near" as const,
      acSlot: "near" as const,
      tableSlot: "farBottom" as const,
    };
    const f = computeLayout(s, catalog).layout!.furniture!;
    for (const c of f.poufs) expect(c.y).toBe(0); // parede de cima (corredor técnico embaixo)
    expect(f.ac.y).toBe(0);
  });

  it("porta de entrada fica na fachada (parede de baixo, lado menor), dentro do salão", () => {
    for (const machineWall of ["left", "right"] as const) {
      const layout = computeLayout({ ...sideState, machineWall }, catalog).layout!;
      const door = layout.frontDoor!;
      expect(door.y).toBe(sideState.roomDepthMm);
      expect(door.width).toBe(900);
      const salonFront = layout.drywall.y + 100;
      if (machineWall === "left") {
        expect(door.x).toBeGreaterThanOrEqual(salonFront);
        expect(door.x + door.width).toBeLessThanOrEqual(sideState.roomWidthMm);
      } else {
        expect(door.x).toBeGreaterThanOrEqual(0);
        expect(door.x + door.width).toBeLessThanOrEqual(sideState.roomWidthMm - salonFront);
      }
    }
  });

  it("cadeiras, mesa e AC nunca saem da planta, em qualquer combinação de encaixes", () => {
    const slots = ["near", "farTop", "farBottom"] as const;
    for (const machineWall of ["left", "right"] as const)
      for (const techAccessSide of ["left", "right"] as const)
        for (const tableSlot of slots)
          for (const chairsSlot of slots)
            for (const acSlot of slots) {
              const s = { ...sideState, machineWall, techAccessSide, tableSlot, chairsSlot, acSlot };
              const f = computeLayout(s, catalog).layout!.furniture!;
              for (const r of [f.table, f.ac, ...f.poufs]) {
                expect(r.x).toBeGreaterThanOrEqual(0);
                expect(r.x + r.width).toBeLessThanOrEqual(s.roomWidthMm);
                expect(r.y).toBeGreaterThanOrEqual(0);
                expect(r.y + r.height).toBeLessThanOrEqual(s.roomDepthMm);
              }
            }
  });

  it("o ar-condicionado fica a ≥60cm das máquinas, do totem e da porta técnica (nunca em cima)", () => {
    const slots = ["near", "farTop", "farBottom"] as const;
    for (const qty of [3, 6])
      for (const machineWall of ["left", "right"] as const)
        for (const techAccessSide of ["left", "right"] as const)
          for (const totemSide of ["left", "right"] as const)
            for (const chairsSlot of slots)
              for (const acSlot of slots) {
                const s = {
                  ...sideState,
                  roomDepthMm: 6000,
                  machines: [{ catalogId: "sq-stack", qty }],
                  machineWall,
                  techAccessSide,
                  totemSide,
                  chairsSlot,
                  acSlot,
                };
                const layout = computeLayout(s, catalog).layout;
                if (!layout) continue; // totem do lado da porta pode não caber com 6
                const { ac, totem } = layout.furniture!;
                const blocked = [...layout.machines, totem, layout.techCorridor].map((r) => ({
                  y: r.y,
                  h: "depthMm" in r ? r.depthMm : r.height,
                }));
                const onDrywall =
                  machineWall === "left"
                    ? ac.x === layout.drywall.y + 100
                    : ac.x + ac.width === s.roomWidthMm - layout.drywall.y - 100;
                if (!onDrywall) continue;
                for (const b of blocked) {
                  // nem em cima, nem a menos de 60cm
                  const clear = Math.max(b.y - (ac.y + ac.height), ac.y - (b.y + b.h));
                  expect(clear).toBeGreaterThanOrEqual(600);
                }
              }
  });

  it("violação de largura mínima aponta pra roomDepthMm quando orientation=side", () => {
    const violations = computeLayout({ ...sideState, roomDepthMm: 1000 }, catalog).violations;
    expect(violations).toContainEqual(
      expect.objectContaining({ code: "WIDTH_TOO_SMALL", field: "roomDepthMm" })
    );
  });

  it("violação de profundidade mínima aponta pra roomWidthMm quando orientation=side", () => {
    const violations = computeLayout({ ...sideState, roomWidthMm: 1000 }, catalog).violations;
    expect(violations).toContainEqual(
      expect.objectContaining({ code: "DEPTH_TOO_SMALL", field: "roomWidthMm" })
    );
  });
});
