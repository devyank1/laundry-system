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

export const FURNITURE_MARGIN_MM = 100; // vão entre itens e entre a mesa/cadeiras e a parede da frente
// Mesa+cadeiras agora ficam em fileira encostada na parede (perto das máquinas,
// mesa primeiro, depois as cadeiras), então a sala só precisa ter largura
// suficiente para a mesa entrar (profundidade dela) + a folga da parede.
export const FURNITURE_BLOCK_WIDTH_MM = TABLE_DEPTH_MM + FURNITURE_MARGIN_MM;

export const AC_WIDTH_MM = 900; // ao longo da parede
export const AC_DEPTH_MM = 200;

export const DOOR_WIDTH_MM = 900;

export const AC_SIZES_BTU = [9000, 12000, 18000, 22000, 30000, 36000, 48000, 60000];
