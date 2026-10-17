// Aceita "8ba68f", "#8BA68F" ou o atalho "#abc"; devolve "#rrggbb" em
// minúsculas, ou null se não for uma cor HEX válida.
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${[...raw.toLowerCase()].map((c) => c + c).join("")}`;
  }
  return null;
}
