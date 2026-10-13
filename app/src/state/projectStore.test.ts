import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "./projectStore";

function getState() {
  return useProjectStore.getState();
}

describe("useProjectStore", () => {
  beforeEach(() => {
    useProjectStore.setState({
      roomWidthMm: 4000,
      roomDepthMm: 3000,
      ceilingHeightMm: 2700,
      machines: [{ catalogId: "sq-stack", qty: 3 }],
      doorEnabled: true,
      techAccessSide: "right",
      furnitureEnabled: true,
      acOverrideBTU: null,
    });
  });

  it("atualiza largura, profundidade e pé-direito", () => {
    getState().setRoomWidthMm(6000);
    getState().setRoomDepthMm(5000);
    getState().setCeilingHeightMm(2900);
    expect(getState().roomWidthMm).toBe(6000);
    expect(getState().roomDepthMm).toBe(5000);
    expect(getState().ceilingHeightMm).toBe(2900);
  });

  it("define a área mantendo a largura e recalculando o comprimento", () => {
    getState().setRoomWidthMm(5000);
    getState().setRoomAreaM2(45);
    expect(getState().roomWidthMm).toBe(5000);
    expect(getState().roomDepthMm).toBe(9000);
  });

  it("ignora a área quando a largura é zero", () => {
    getState().setRoomWidthMm(0);
    getState().setRoomAreaM2(45);
    expect(getState().roomDepthMm).toBe(3000);
  });

  it("adiciona uma nova seleção de máquina quando o catalogId não existe ainda", () => {
    getState().setMachineQty("mamute-smart10", 2);
    expect(getState().machines).toContainEqual({ catalogId: "mamute-smart10", qty: 2 });
  });

  it("atualiza a quantidade de uma máquina já selecionada", () => {
    getState().setMachineQty("sq-stack", 5);
    expect(getState().machines).toContainEqual({ catalogId: "sq-stack", qty: 5 });
  });

  it("remove a seleção quando a quantidade vira zero", () => {
    getState().setMachineQty("sq-stack", 0);
    expect(getState().machines.find((m) => m.catalogId === "sq-stack")).toBeUndefined();
  });

  it("remove uma máquina explicitamente", () => {
    getState().removeMachine("sq-stack");
    expect(getState().machines).toEqual([]);
  });

  it("alterna porta e mobiliário", () => {
    getState().toggleDoor();
    expect(getState().doorEnabled).toBe(false);
    getState().toggleFurniture();
    expect(getState().furnitureEnabled).toBe(false);
  });

  it("define o lado de acesso técnico", () => {
    getState().setTechAccessSide("left");
    expect(getState().techAccessSide).toBe("left");
  });

  it("define o override de BTU", () => {
    getState().setAcOverrideBTU(36000);
    expect(getState().acOverrideBTU).toBe(36000);
  });
});
