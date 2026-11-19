import { supabase } from "../lib/supabaseClient";

// Bucket privado; cada pessoa só grava em "<seu id>/photo" (policy no banco).
const BUCKET = "profile-photos";
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIDE = 1024;

export function photoProblem(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return "Envie uma foto JPG, PNG ou WEBP.";
  if (file.size > MAX_PHOTO_BYTES) return "A foto precisa ter até 2 MB.";
  return null;
}

// Foto de celular costuma passar de 2 MB: reduz pra no máximo 1024 px em JPEG
// antes de validar. Sem suporte no navegador, segue com o arquivo original.
export async function shrinkPhoto(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || !ACCEPTED.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export async function uploadMyPhoto(userId: string, file: File): Promise<string> {
  const problem = photoProblem(file);
  if (problem) throw new Error(problem);
  const path = `${userId}/photo`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error("Não foi possível enviar a foto. Tente novamente.");
  return path;
}

export async function photoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return error || !data ? null : data.signedUrl;
}
