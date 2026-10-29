export const LATERAL_CLEARANCE_MM = 500;
export const MACHINE_GAP_MM = 20;
export const TECH_AREA_MIN_MM = 1000;
export const TECH_AREA_MAX_MM = 1100;
export const TECH_AREA_DEFAULT_MM = 1050;
export const DRYWALL_THICKNESS_MM = 100;
export const SALON_MIN_DEPTH_MM = 1800;
export const CEILING_CLEARANCE_MM = 300;

// Totem de pagamento embutido no drywall, ao lado das máquinas.
export const TOTEM_SIZE_MM = { width: 400, depth: 150, height: 550 };
export const TOTEM_MOUNT_CENTER_MM = 1200; // centro da tela a 1,20m do chão
export const TOTEM_WALL_MM = 500; // trecho de drywall entre a última máquina e a porta técnica

// Porta técnica no drywall, que dá acesso à área técnica atrás das máquinas.
export const TECH_DOOR_WIDTH_MM = 700;
export const TECH_DOOR_HEIGHT_MM = 2100;

// Cadeira plástica (porta_pl_stica_3d.html) — assento quadrado de 42cm.
export const CHAIR_SIZE_MM = 420;
export const CHAIR_HEIGHT_MM = 900;

// Mesa inox com cestos (mesa_inox_com_cestos.html) — 2,00 x 0,80m reais.
export const TABLE_WIDTH_MM = 2000; // comprimento, corre ao longo da parede
export const TABLE_DEPTH_MM = 800; // o quanto ela entra sala adentro

export const FURNITURE_MARGIN_MM = 100; // vão entre itens
// Distância da frente da máquina (linha do drywall) até a mesa — trânsito de pessoas.
export const FURNITURE_CIRCULATION_GAP_MM = 1000;
// Mesa fica perpendicular à parede (comprimento de 2m entrando sala adentro),
// então a sala precisa ter largura suficiente pra ela + a folga da parede.
export const FURNITURE_BLOCK_WIDTH_MM = TABLE_WIDTH_MM + FURNITURE_MARGIN_MM;

export const AC_WIDTH_MM = 900; // ao longo da parede
export const AC_DEPTH_MM = 200;

export const DOOR_WIDTH_MM = 900;

export const AC_SIZES_BTU = [9000, 12000, 18000, 22000, 30000, 36000, 48000, 60000];

// Lavanderia premium: a partir de 30 m² (largura x profundidade) a loja ganha
// o balcão alto com banquetas (e os próximos itens premium).
export const PREMIUM_MIN_AREA_MM2 = 30_000_000;
// Balcão alto de madeira com 3 banquetas (Cadeira com mesa Trab.html): 2,00m de
// comprimento, 0,75m de profundidade já contando as banquetas.
export const COUNTER_WIDTH_MM = 2000;
export const COUNTER_DEPTH_MM = 750;
// Conjunto de 3 pufs hexagonais encaixados (pufs.html), no meio do salão:
// caixa quadrada que envolve os três.
export const PUFS_SIZE_MM = 1200;

// Máquina pesada (Mamute Smart 17, 615 kg) fica sobre uma base de concreto
// de 2 cm: o peso não vai direto no piso.
export const HEAVY_MACHINE_KG = 400;
export const CONCRETE_BASE_MM = 20;

export function concreteBaseMm(weightKg: number | undefined): number {
  return (weightKg ?? 0) >= HEAVY_MACHINE_KG ? CONCRETE_BASE_MM : 0;
}

/** Altura em que a máquina fica: base/suporte do catálogo, senão a regra do peso. */
export function machineBaseMm(m: { concreteBaseMm?: number; weightKg?: number }): number {
  return m.concreteBaseMm ?? concreteBaseMm(m.weightKg);
}
