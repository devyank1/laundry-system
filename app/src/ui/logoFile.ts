// Assinatura fixa de todo arquivo PNG (8 primeiros bytes).
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export class NotPngError extends Error {
  constructor() {
    super("A logo precisa ser um arquivo PNG (fundo transparente).");
  }
}

// Lê o arquivo como data URL, só se for PNG de verdade — confere a
// assinatura do arquivo, não só a extensão/tipo informado pelo navegador.
export async function readPngAsDataUrl(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  if (!PNG_SIGNATURE.every((byte, i) => head[i] === byte)) throw new NotPngError();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
