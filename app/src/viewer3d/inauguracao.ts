import type { Layout } from "../engine/types";
import { facadeDims } from "./facade";

// "Modo inauguração": onde ficam os itens de festa. Fora da loja (arco de
// balões, carrinho de pipoca e mesa de lembranças) ancora na fachada; dentro
// Metros no mundo 3D (x = largura, z = comprimento). Dispensers, lixeira,
// tapetes (rugs.ts) e o balcão e pufs (engine/layout.ts) são fixos da loja.

export const BALLOON_ARCH_RADIUS = 1.56; // 13 * escala do modelo (0,12)
const ARCH_STANDOFF = 0.3; // do fim da marquise até o arco
const MARQUEE_PROJECTION = 0.45;
const CART_OFFSET_X = 2.4; // do centro da porta até o carrinho
const CART_STREET_GAP = 1.4;

export interface InauguracaoPlacement {
  arch: { x: number; z: number };
  cart: { x: number; z: number };
  keepsakeTable: { x: number; z: number };
}

export function placeInauguracao(layout: Layout): InauguracaoPlacement {
  const f = facadeDims(layout);
  const doorX = (f.door.x0 + f.door.x1) / 2;

  const arch = { x: doorX, z: f.frontZ + MARQUEE_PROJECTION + ARCH_STANDOFF };
  const cart = { x: doorX + CART_OFFSET_X, z: f.frontZ + CART_STREET_GAP };
  // Mesa de lembranças na calçada, à esquerda da porta (espelho do carrinho).
  const keepsakeTable = { x: doorX - CART_OFFSET_X, z: f.frontZ + CART_STREET_GAP };

  return { arch, cart, keepsakeTable };
}
