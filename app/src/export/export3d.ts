import { downloadDataUrl } from "./download";

export function exportSceneScreenshot(canvas: HTMLCanvasElement, filename = "planta-3d.png"): void {
  const dataUrl = canvas.toDataURL("image/png");
  downloadDataUrl(dataUrl, filename);
}
