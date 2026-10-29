import { describe, expect, it } from "vitest";
import { machineModelFor } from "./machineModel";

describe("machineModelFor", () => {
  it("usa o modelo Speed Queen para a Stack da Speed Queen", () => {
    expect(machineModelFor("sq-stack")).toEqual({ kind: "speedQueen" });
  });

  it("usa o modelo próprio da SSU/SSG", () => {
    expect(machineModelFor("sq-ssu030")).toEqual({ kind: "speedQueenSsu" });
  });

  it("usa os modelos próprios da lavadora SYC180 e da secadora ST055", () => {
    expect(machineModelFor("sq-syc180")).toEqual({ kind: "speedQueenSyc" });
    expect(machineModelFor("sq-st055")).toEqual({ kind: "speedQueenSt" });
  });

  it("usa o modelo LG para Giant C e Titan", () => {
    expect(machineModelFor("lg-giant-c")).toEqual({ kind: "lg" });
    expect(machineModelFor("lg-titan")).toEqual({ kind: "lg" });
  });

  it("usa a torre branca para a Mamute Smart 10", () => {
    expect(machineModelFor("mamute-smart10")).toEqual({ kind: "tower", finish: "white" });
  });

  it("usa a torre prata para a Mamute Smart 17", () => {
    expect(machineModelFor("mamute-smart17")).toEqual({ kind: "tower", finish: "silver" });
  });

  it("usa a torre branca para máquinas cadastradas pelo usuário", () => {
    expect(machineModelFor("custom-123")).toEqual({ kind: "tower", finish: "white" });
  });
});
