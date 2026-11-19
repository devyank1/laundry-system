// Logo do cliente (fachada): chega em PNG com fundo transparente. Antes de
// guardar, reduz pra no máximo 1000 px e converte pra WebP (mantém a
// transparência). Navegador que não gera WebP (Safari) devolve PNG, que
// guardamos reduzido. Sem canvas, fica o arquivo original.
export const LOGO_MAX_SIDE = 1000;

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, data] = dataUrl.split(",", 2);
  const type = /^data:([^;,]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const binary = atob(data ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function shrinkLogo(file: File): Promise<string> {
  if (typeof createImageBitmap !== "function") return blobToDataUrl(file);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return blobToDataUrl(file);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    return blob ? blobToDataUrl(blob) : blobToDataUrl(file);
  } catch {
    return blobToDataUrl(file);
  }
}
