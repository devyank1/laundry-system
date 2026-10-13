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
  text: "#e2e8f0",
} as const;

// Mamute Smart 17 é a máquina grande em cinza; as demais torres são brancas.
const GRAY_MACHINES = new Set(["mamute-smart17"]);

export function machineColor(catalogId: string): string {
  return GRAY_MACHINES.has(catalogId) ? PLAN_COLORS.machineGray : PLAN_COLORS.machineWhite;
}

export function formatMeters(mm: number): string {
  return (mm / 1000).toFixed(2).replace(".", ",");
}
