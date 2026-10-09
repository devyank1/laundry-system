import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayout } from "./useLayout";
import { useProjectStore } from "./projectStore";

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({
    roomWidthMm: 5000,
    roomDepthMm: 4200,
    ceilingHeightMm: 2400,
    machines: [{ catalogId: "sq-stack", qty: 2 }],
    doorEnabled: true,
    techAccessSide: "right",
    furnitureEnabled: true,
    acOverrideBTU: null,
  });
});

describe("useLayout", () => {
  it("retorna um layout válido para um estado consistente", () => {
    const { result } = renderHook(() => useLayout());
    expect(result.current.violations).toEqual([]);
    expect(result.current.layout?.machines).toHaveLength(2);
  });

  it("recalcula quando o estado do projeto muda", () => {
    const { result } = renderHook(() => useLayout());
    act(() => {
      useProjectStore.getState().setMachineQty("sq-stack", 5);
    });
    expect(result.current.layout?.machines).toHaveLength(5);
  });
});
