import { CanvasTexture, SRGBColorSpace } from "three";

const cache = new Map<string, CanvasTexture | null>();

// Textura desenhada em canvas, criada uma vez por chave e compartilhada entre instâncias.
export function cachedCanvasTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): CanvasTexture | null {
  if (cache.has(key)) return cache.get(key) ?? null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  let texture: CanvasTexture | null = null;
  if (ctx) {
    draw(ctx);
    texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
  }
  cache.set(key, texture);
  return texture;
}
