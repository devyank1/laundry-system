import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mfa = vi.hoisted(() => ({ startEnroll: vi.fn(), verifyCode: vi.fn(), verifiedFactorId: vi.fn() }));
vi.mock("../auth/mfa", () => mfa);

import { MfaPage } from "./MfaPage";

const onDone = vi.fn(async () => {});
const onSignOut = vi.fn(async () => {});

beforeEach(() => {
  for (const fn of [...Object.values(mfa), onDone, onSignOut]) fn.mockReset();
  mfa.startEnroll.mockResolvedValue({ factorId: "f2", qrCode: "data:image/svg+xml;utf8,<svg/>", secret: "ABCSECRET" });
  mfa.verifiedFactorId.mockResolvedValue("f1");
  mfa.verifyCode.mockResolvedValue(undefined);
});

describe("MfaPage", () => {
  it("cadastro: mostra QR code e chave, confirma o código e libera", async () => {
    render(<MfaPage mode="enroll" onDone={onDone} onSignOut={onSignOut} />);
    expect(await screen.findByRole("img", { name: /qr code/i })).toBeInTheDocument();
    expect(screen.getByText("ABCSECRET")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/código de 6 dígitos/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(mfa.verifyCode).toHaveBeenCalledWith("f2", "123456");
    expect(onDone).toHaveBeenCalled();
  });

  it("verificação: usa o celular já cadastrado, sem QR code", async () => {
    render(<MfaPage mode="verify" onDone={onDone} onSignOut={onSignOut} />);
    await userEvent.type(await screen.findByLabelText(/código de 6 dígitos/i), "654321");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(mfa.verifyCode).toHaveBeenCalledWith("f1", "654321");
    expect(screen.queryByRole("img", { name: /qr code/i })).not.toBeInTheDocument();
    expect(mfa.startEnroll).not.toHaveBeenCalled();
  });

  it("código errado mostra aviso e deixa tentar de novo", async () => {
    mfa.verifyCode.mockRejectedValueOnce(new Error("Código inválido."));
    render(<MfaPage mode="verify" onDone={onDone} onSignOut={onSignOut} />);
    await userEvent.type(await screen.findByLabelText(/código de 6 dígitos/i), "000000");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido.");
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/código de 6 dígitos/i)).toHaveValue("");
  });

  it("código com menos de 6 dígitos nem vai pro servidor", async () => {
    render(<MfaPage mode="verify" onDone={onDone} onSignOut={onSignOut} />);
    await userEvent.type(await screen.findByLabelText(/código de 6 dígitos/i), "12a");
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mfa.verifyCode).not.toHaveBeenCalled();
  });

  it("botão Sair encerra a sessão", async () => {
    render(<MfaPage mode="verify" onDone={onDone} onSignOut={onSignOut} />);
    await userEvent.click(await screen.findByRole("button", { name: /sair/i }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
