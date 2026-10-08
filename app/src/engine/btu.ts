import { AC_SIZES_BTU } from "./constants";

export function suggestBTU(areaM2: number, dryerCount: number): number {
  const base = areaM2 * 600 + dryerCount * 2000;
  const found = AC_SIZES_BTU.find((size) => size >= base);
  return found ?? AC_SIZES_BTU[AC_SIZES_BTU.length - 1];
}
