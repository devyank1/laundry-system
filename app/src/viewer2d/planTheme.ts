// Paleta compartilhada entre a planta 2D e o studio 3D.
export const PLAN_COLORS = {
  background: "#0f172a",
  grid: "#334155",
  roomOutline: "#38bdf8",
  wall: "#94a3b8",
  drywall: "#7dd3fc",
  techArea: "#f87171",
  machineWhite: "#f8fafc",
  machineGray: "#64748b",
  machineStroke: "#1e293b",
  machineDoor: "#0b1120",
  door: "#f59e0b",
  totem: "#10b981",
  table: "#e2e8f0",
  tableStroke: "#94a3b8",
  ac: "#7fb3d5",
  exhaust: "#fb923c", // duto de exaustão das secadoras
  electrical: "#facc15", // eletrocalha e perfilados de alumínio
  water: "#38bdf8", // água: pressurizador, barramento e derivações
  sewer: "#a8a29e", // esgoto: canal de resíduos com grelha
  counter: "#dec29b", // madeira clara do balcão premium
  text: "#e2e8f0",
} as const;

// Planta 2D no padrão das pranchas de projeto (pasta /plantas): papel branco,
// traço preto e as instalações por cor.
export const CAD = {
  paper: "#ffffff",
  ink: "#111111",
  gray: "#6b7280",
  roomLabel: "#9a9a9a", // nome do ambiente + área, cinza grande
  furniture: "#4b5563",
  water: "#1d4ed8", // água fria
  sewer: "#15803d", // esgoto
  electrical: "#d4a017", // eletrocalha / perfilado
  outlet: "#1d4ed8", // tomadas (triângulo azul)
  exhaust: "#ea580c",
  acDrain: "#0e7490", // dreno do ar-condicionado
  panel: "#dc2626", // quadro de distribuição / ar-condicionado (vermelho, como nas pranchas)
} as const;

// Mamute Smart 17 é a máquina grande em cinza; as demais torres são brancas.
const GRAY_MACHINES = new Set(["mamute-smart17"]);

export function machineColor(catalogId: string): string {
  return GRAY_MACHINES.has(catalogId) ? PLAN_COLORS.machineGray : PLAN_COLORS.machineWhite;
}

export function formatMeters(mm: number): string {
  return (mm / 1000).toFixed(2).replace(".", ",");
}
