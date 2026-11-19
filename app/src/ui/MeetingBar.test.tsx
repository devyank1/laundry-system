import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const api = vi.hoisted(() => ({ saveMeeting: vi.fn(async () => {}) }));
vi.mock("../clients/api", () => ({ saveMeeting: api.saveMeeting, logoPathFor: (c: { companyId: string; id: string }) => `${c.companyId}/${c.id}/logo` }));
vi.mock("../clients/meeting", () => ({ meetingFingerprint: () => "fp" }));

import { MeetingBar } from "./MeetingBar";
import { useMeetingSession } from "../clients/sessionStore";
import { useProjectStore } from "../state/projectStore";

beforeEach(() => {
  api.saveMeeting.mockClear();
  useMeetingSession.getState().unbind();
  useProjectStore.setState({ logoDataUrl: null });
});

describe("MeetingBar", () => {
  it("some sem cliente ligado", () => {
    const { container } = render(<MeetingBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("responsável salva na reunião do cliente ligado", async () => {
    useMeetingSession.getState().bind({ id: "cl1", name: "Lava Já", canSave: true, companyId: "c1", logoPath: null });
    useProjectStore.setState({ logoDataUrl: "data:image/webp;base64,AA" });
    render(<MeetingBar />);
    expect(screen.getByText("Reunião de Lava Já")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar reunião" }));
    expect(api.saveMeeting).toHaveBeenCalledWith(expect.objectContaining({ id: "cl1", companyId: "c1", logoPath: null }), "data:image/webp;base64,AA");
    expect(await screen.findByRole("status")).toHaveTextContent("Reunião salva.");
    expect(useMeetingSession.getState().logoPath).toBe("c1/cl1/logo");
  });

  it("dono vendo reunião de vendedor não salva por cima", () => {
    useMeetingSession.getState().bind({ id: "cl1", name: "Lava Já", canSave: false, companyId: "c1", logoPath: null });
    render(<MeetingBar />);
    expect(screen.getByRole("button", { name: "Salvar reunião" })).toBeDisabled();
    expect(screen.getByText("Só o vendedor responsável salva esta reunião.")).toBeInTheDocument();
  });

  it("Fechar desliga o cliente", async () => {
    useMeetingSession.getState().bind({ id: "cl1", name: "Lava Já", canSave: true, companyId: "c1", logoPath: null });
    render(<MeetingBar />);
    await userEvent.click(screen.getByRole("button", { name: "Fechar reunião" }));
    expect(useMeetingSession.getState().clientId).toBeNull();
  });
});
