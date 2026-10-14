import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViolationsPanel } from "./ViolationsPanel";
import { useProjectStore } from "../state/projectStore";
import type { Violation } from "../engine/types";

beforeEach(() => {
  useProjectStore.setState({
    roomWidthMm: 1000,
    roomDepthMm: 3500,
    ceilingHeightMm: 2700,
    machines: [{ catalogId: "sq-stack", qty: 3 }],
    doorEnabled: true,
    techAccessSide: "right",
    furnitureEnabled: true,
    furnitureSide: "left",
    acOverrideBTU: null,
  });
});

describe("ViolationsPanel", () => {
  it("não renderiza nada quando não há violações", () => {
    const { container } = render(<ViolationsPanel violations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a mensagem e aplica a sugestão ao clicar no botão", async () => {
    const violation: Violation = {
      code: "WIDTH_TOO_SMALL",
      message: "Largura insuficiente. Mínimo: 3.07m.",
      field: "roomWidthMm",
      suggestedValueMm: 3070,
    };
    render(<ViolationsPanel violations={[violation]} />);
    expect(screen.getByText(/largura insuficiente/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /aplicar sugestão/i }));
    expect(useProjectStore.getState().roomWidthMm).toBe(3070);
  });
});
