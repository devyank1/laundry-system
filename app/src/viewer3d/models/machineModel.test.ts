import { describe, expect, it } from "vitest";
import { machineModelFor } from "./machineModel";

describe("machineModelFor", () => {
  it("usa o modelo Speed Queen para a Stack da Speed Queen", () => {
    expect(machineModelFor("sq-stack")).toEqual({ kind: "speedQueen" });
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
