// Cor do drywall no 3D derivada da cor da fachada: mesmo tom e saturação,
// mais escura — assim as duas sempre combinam (#8fa892 → #5b765f).
const DRYWALL_DARKEN = 0.2; // pontos de luminosidade (HSL, 0–1) a menos
const MIN_LIGHTNESS = 0.08;

export function drywallColorFor(facadeHex: string): string {
  const [h, s, l] = hexToHsl(facadeHex);
  return hslToHex(h, s, Math.max(MIN_LIGHTNESS, l - DRYWALL_DARKEN));
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace(/^#/, ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v + m)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
