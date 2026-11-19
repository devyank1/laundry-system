import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blobToDataUrl, dataUrlToBlob, LOGO_MAX_SIDE, shrinkLogo } from "./logoImage";

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], "logo.png", { type: "image/png" });
let drawn: { width: number; height: number; type: string } | null;
let blobType = "image/webp";
const origToBlob = HTMLCanvasElement.prototype.toBlob;
const origGetContext = HTMLCanvasElement.prototype.getContext;

function fakeImage(width: number, height: number) {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width, height, close: () => {} })));
}

beforeEach(() => {
  drawn = null;
  blobType = "image/webp";
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn(), clearRect: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, cb: BlobCallback, type?: string) {
    drawn = { width: this.width, height: this.height, type: type ?? "" };
    cb(new Blob(["img"], { type: blobType }));
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  HTMLCanvasElement.prototype.toBlob = origToBlob;
  HTMLCanvasElement.prototype.getContext = origGetContext;
});

describe("shrinkLogo", () => {
  it("reduz pra no máximo 1000 px e pede WebP", async () => {
    fakeImage(4000, 2000);
    const url = await shrinkLogo(png());
    expect(LOGO_MAX_SIDE).toBe(1000);
    expect(drawn).toEqual({ width: 1000, height: 500, type: "image/webp" });
    expect(url).toMatch(/^data:image\/webp;base64,/);
  });

  it("navegador sem WebP (Safari) cai em PNG reduzido", async () => {
    fakeImage(4000, 2000);
    blobType = "image/png";
    const url = await shrinkLogo(png());
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(drawn?.width).toBe(1000);
  });

  it("não amplia logo pequena", async () => {
    fakeImage(800, 600);
    await shrinkLogo(png());
    expect(drawn).toMatchObject({ width: 800, height: 600 });
  });

  it("sem suporte a canvas devolve o PNG original", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const url = await shrinkLogo(png());
    expect(url).toBe(await blobToDataUrl(png()));
    expect(drawn).toBeNull();
  });
});

describe("data URL", () => {
  it("ida e volta preserva bytes e tipo", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 250])], { type: "image/webp" });
    const back = dataUrlToBlob(await blobToDataUrl(blob));
    expect(back.type).toBe("image/webp");
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 250]));
  });
});
