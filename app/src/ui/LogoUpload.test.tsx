import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogoUpload } from "./LogoUpload";
import { useProjectStore } from "../state/projectStore";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

beforeEach(() => {
  useProjectStore.setState({ logoDataUrl: null });
});

describe("LogoUpload", () => {
  it("aceita um PNG e guarda como data URL, mostrando a prévia", async () => {
    render(<LogoUpload />);
    const file = new File([PNG_BYTES], "logo.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/enviar logo/i), file);
    await waitFor(() =>
      expect(useProjectStore.getState().logoDataUrl).toMatch(/^data:image\/png;base64,/)
    );
    expect(screen.getByAltText("Logo atual")).toBeInTheDocument();
  });

  it("recusa arquivo que não é PNG de verdade, mesmo com extensão .png", async () => {
    render(<LogoUpload />);
    const fake = new File([JPG_BYTES], "logo.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/enviar logo/i), fake);
    expect(await screen.findByRole("alert")).toHaveTextContent(/PNG/);
    expect(useProjectStore.getState().logoDataUrl).toBeNull();
  });

  it("remove a logo atual", async () => {
    useProjectStore.setState({ logoDataUrl: "data:image/png;base64,AAAA" });
    render(<LogoUpload />);
    await userEvent.click(screen.getByRole("button", { name: /remover logo/i }));
    expect(useProjectStore.getState().logoDataUrl).toBeNull();
  });
});
