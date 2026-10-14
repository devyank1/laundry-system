import { forwardRef } from "react";
import type { Layout } from "../engine/types";
import { PLAN_COLORS, formatMeters, machineColor } from "./planTheme";

const SCALE = 0.08; // px por mm
const PAD_X = 30;
const PAD_TOP = 44;
const MIN_CONTENT_WIDTH = 440;
const LEGEND_COL_WIDTH = 150;
const LEGEND_ROW_HEIGHT = 18;

function mm(value: number): number {
  return value * SCALE;
}

const LEGEND = [
  { label: "Parede Drywall: Azul Claro", fill: PLAN_COLORS.drywall },
  { label: "Frota Padrão: Brancas", fill: PLAN_COLORS.machineWhite },
  { label: "Mamute 17kg: Cinza", fill: PLAN_COLORS.machineGray },
  { label: "Porta Técnica 0,70m", fill: PLAN_COLORS.door },
  { label: "Totem (embutido)", fill: PLAN_COLORS.totem },
  { label: "Área Técnica", fill: PLAN_COLORS.techArea },
  { label: "Ar-condicionado", fill: PLAN_COLORS.ac },
  { label: "Cadeiras", fill: "#475569" },
];

export const FloorPlan = forwardRef<SVGSVGElement, { layout: Layout }>(function FloorPlan(
  { layout },
  ref
) {
  const width = mm(layout.roomWidthMm);
  const height = mm(layout.roomDepthMm);

  const viewWidth = Math.max(width, MIN_CONTENT_WIDTH) + PAD_X * 2;
  const offsetX = (viewWidth - width) / 2;
  const legendCols = Math.max(1, Math.floor((viewWidth - PAD_X * 2) / LEGEND_COL_WIDTH));
  const legendRows = Math.ceil(LEGEND.length / legendCols);
  const legendTop = PAD_TOP + height + 28;
  const viewHeight = legendTop + legendRows * LEGEND_ROW_HEIGHT + 12;

  const isSide = layout.orientation === "side";
  const alongLengthMm = isSide ? layout.roomDepthMm : layout.roomWidthMm;

  // Converte uma posição/retângulo em termos (along, across) — along é o
  // eixo em que a fileira de máquinas corre, across é da parede dela até a
  // frente — pra coordenadas de tela, já na escala de px. Em orientation=
  // "back" along=X e across=Y (como sempre foi); em "side" eles trocam de
  // eixo. É o espelho, no viewer, do mesmo toXY()/orientedRect() do motor —
  // os retângulos que já vêm prontos de `layout` (máquinas, totem, mesa,
  // cadeiras, AC, corredor) não precisam disso, só os elementos que esse
  // componente desenha "na mão" (linha do drywall, arco das portas, área
  // técnica), que até aqui sempre assumiram a parede de fundo horizontal.
  function alongAcrossPoint(alongMm: number, acrossMm: number): { x: number; y: number } {
    return isSide ? { x: mm(acrossMm), y: mm(alongMm) } : { x: mm(alongMm), y: mm(acrossMm) };
  }
  function alongAcrossRect(alongMm: number, acrossMm: number, alongExtMm: number, acrossExtMm: number) {
    return isSide
      ? { x: mm(acrossMm), y: mm(alongMm), w: mm(acrossExtMm), h: mm(alongExtMm) }
      : { x: mm(alongMm), y: mm(acrossMm), w: mm(alongExtMm), h: mm(acrossExtMm) };
  }

  const techDepthMm =
    layout.machines.length > 0 ? Math.min(...layout.machines.map((m) => m.y)) : 0;
  const areaM2 = (layout.roomWidthMm / 1000) * (layout.roomDepthMm / 1000);
  const techAreaRect = alongAcrossRect(0, 0, alongLengthMm, techDepthMm);
  const techAreaLabelCenter = alongAcrossPoint(alongLengthMm / 2, techDepthMm / 2);

  // Porta técnica: dobradiça do lado da parede, abrindo para a área técnica.
  // techDoor.x/.y já vêm do motor na orientação certa; aqui só decidimos de
  // qual lado do eixo "along" ela está (hingeAtStart) pra desenhar o gonzo
  // e o arco apontando pro lado certo em qualquer orientação.
  const techDoor = layout.techDoor;
  const doorAlongMm = isSide ? techDoor.y : techDoor.x;
  const doorAcrossMm = isSide ? techDoor.x : techDoor.y;
  const hingeAtStart = doorAlongMm === 0;
  const hingeAlongMm = hingeAtStart ? doorAlongMm : doorAlongMm + techDoor.width;
  const hinge = alongAcrossPoint(hingeAlongMm, doorAcrossMm);
  const swingEnd = alongAcrossPoint(hingeAlongMm, doorAcrossMm - techDoor.width);
  const closedTip = alongAcrossPoint(doorAlongMm + (hingeAtStart ? techDoor.width : 0), doorAcrossMm);
  const doorSweepFlag = isSide ? (hingeAtStart ? 1 : 0) : hingeAtStart ? 0 : 1;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      width="100%"
      role="img"
      aria-label="Planta baixa da lavanderia"
      fontFamily="Inter, system-ui, sans-serif"
    >
      <rect x={0} y={0} width={viewWidth} height={viewHeight} fill={PLAN_COLORS.background} />

      <text
        x={viewWidth / 2}
        y={PAD_TOP - 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={PLAN_COLORS.roomOutline}
      >
        {`FACHADA: ${(layout.roomWidthMm / 1000).toFixed(2)}m | COMPRIMENTO: ${(
          layout.roomDepthMm / 1000
        ).toFixed(2)}m | ÁREA TOTAL: ${areaM2.toFixed(1)}m²`}
      </text>

      <g transform={`translate(${offsetX} ${PAD_TOP})`}>
        <rect x={0} y={0} width={width} height={height} fill="#111c33" />

        {techDepthMm > 0 && (
          <>
            <rect
              x={techAreaRect.x}
              y={techAreaRect.y}
              width={techAreaRect.w}
              height={techAreaRect.h}
              fill={PLAN_COLORS.techArea}
              fillOpacity={0.15}
              stroke={PLAN_COLORS.techArea}
              strokeDasharray="5 3"
            />
            <text
              x={techAreaLabelCenter.x}
              y={techAreaLabelCenter.y + 3}
              textAnchor="middle"
              fontSize={8}
              fontWeight={700}
              fill="#fca5a5"
            >
              {`ÁREA TÉCNICA MANUTENÇÃO (${formatMeters(techDepthMm)}m)`}
            </text>
          </>
        )}

        <rect
          x={mm(layout.techCorridor.x)}
          y={mm(layout.techCorridor.y)}
          width={mm(layout.techCorridor.width)}
          height={mm(layout.techCorridor.height)}
          fill="none"
          stroke={PLAN_COLORS.wall}
          strokeDasharray="6 4"
        />

        {isSide ? (
          <>
            <line
              x1={mm(layout.drywall.y)}
              y1={0}
              x2={mm(layout.drywall.y)}
              y2={mm(layout.techCorridor.y)}
              stroke={PLAN_COLORS.drywall}
              strokeWidth={4}
            />
            <line
              x1={mm(layout.drywall.y)}
              y1={mm(layout.techCorridor.y + layout.techCorridor.height)}
              x2={mm(layout.drywall.y)}
              y2={height}
              stroke={PLAN_COLORS.drywall}
              strokeWidth={4}
            />
          </>
        ) : (
          <>
            <line
              x1={0}
              y1={mm(layout.drywall.y)}
              x2={mm(layout.techCorridor.x)}
              y2={mm(layout.drywall.y)}
              stroke={PLAN_COLORS.drywall}
              strokeWidth={4}
            />
            <line
              x1={mm(layout.techCorridor.x + layout.techCorridor.width)}
              y1={mm(layout.drywall.y)}
              x2={width}
              y2={mm(layout.drywall.y)}
              stroke={PLAN_COLORS.drywall}
              strokeWidth={4}
            />
          </>
        )}

        <line
          x1={hinge.x}
          y1={hinge.y}
          x2={swingEnd.x}
          y2={swingEnd.y}
          stroke={PLAN_COLORS.door}
          strokeWidth={3}
        />
        <path
          data-door="tech"
          d={`M ${closedTip.x} ${closedTip.y} A ${mm(techDoor.width)} ${mm(
            techDoor.width
          )} 0 0 ${doorSweepFlag} ${swingEnd.x} ${swingEnd.y}`}
          fill="none"
          stroke={PLAN_COLORS.door}
          strokeDasharray="4 3"
        />
        <text
          x={hinge.x + (hingeAtStart ? 3 : -3)}
          y={hinge.y + 12}
          textAnchor={hingeAtStart ? "start" : "end"}
          fontSize={7}
          fontWeight={700}
          fill={PLAN_COLORS.door}
        >
          {`PORTA TÉC. ${formatMeters(techDoor.width)}m`}
        </text>

        {layout.machines.map((machine, i) => {
          const fill = machineColor(machine.catalogId);
          const cx = mm(machine.x + machine.widthMm / 2);
          const cy = mm(machine.y + machine.depthMm / 2);
          const doorRadius = Math.min(mm(machine.widthMm), mm(machine.depthMm)) * 0.32;
          const labelColor = fill === PLAN_COLORS.machineWhite ? PLAN_COLORS.machineStroke : "#fff";
          return (
            <g key={`${machine.catalogId}-${machine.instanceIndex}`}>
              <rect
                x={mm(machine.x)}
                y={mm(machine.y)}
                width={mm(machine.widthMm)}
                height={mm(machine.depthMm)}
                fill={fill}
                stroke={PLAN_COLORS.machineStroke}
                strokeWidth={1.5}
                rx={2}
              />
              <circle cx={cx} cy={cy} r={doorRadius} fill="none" stroke={labelColor} strokeWidth={1.2} />
              <text
                x={cx}
                y={cy + 3}
                textAnchor="middle"
                fontSize={8}
                fontWeight={700}
                fill={labelColor}
              >
                {`T${i + 1}`}
              </text>
            </g>
          );
        })}

        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="none"
          stroke={PLAN_COLORS.roomOutline}
          strokeWidth={3}
        />

        {layout.frontDoor &&
          (() => {
            const fd = layout.frontDoor;
            const alongMm = isSide ? fd.y : fd.x;
            const acrossMm = isSide ? fd.x : fd.y; // parede da frente (canto oposto à fileira)
            const wallStart = alongAcrossPoint(alongMm, acrossMm);
            const wallEnd = alongAcrossPoint(alongMm + fd.width, acrossMm);
            const openEnd = alongAcrossPoint(alongMm, acrossMm - fd.width);
            const labelCenter = alongAcrossPoint(alongMm + fd.width / 2, acrossMm);
            return (
              <>
                <line
                  x1={wallStart.x}
                  y1={wallStart.y}
                  x2={wallEnd.x}
                  y2={wallEnd.y}
                  stroke={PLAN_COLORS.door}
                  strokeWidth={5}
                />
                <path
                  data-door="front"
                  d={`M ${wallEnd.x} ${wallEnd.y} A ${mm(fd.width)} ${mm(fd.width)} 0 0 1 ${openEnd.x} ${openEnd.y}`}
                  fill="none"
                  stroke={PLAN_COLORS.door}
                  strokeDasharray="4 3"
                />
                <text
                  x={labelCenter.x}
                  y={labelCenter.y + (isSide ? 0 : 14)}
                  dx={isSide ? 14 : 0}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight={700}
                  fill={PLAN_COLORS.door}
                >
                  {`PORTA ${formatMeters(fd.width)}m`}
                </text>
              </>
            );
          })()}

        {layout.furniture && (
          <>
            <rect
              x={mm(layout.furniture.totem.x)}
              y={mm(layout.furniture.totem.y)}
              width={mm(layout.furniture.totem.width)}
              height={mm(layout.furniture.totem.height)}
              fill={PLAN_COLORS.totem}
              rx={2}
            />
            {layout.furniture.poufs.map((p, i) => (
              <circle
                key={i}
                data-pouf
                cx={mm(p.x + p.width / 2)}
                cy={mm(p.y + p.height / 2)}
                r={mm(p.width / 2)}
                fill="#475569"
                stroke="#64748b"
                strokeWidth={1.5}
              />
            ))}
            <rect
              x={mm(layout.furniture.table.x)}
              y={mm(layout.furniture.table.y)}
              width={mm(layout.furniture.table.width)}
              height={mm(layout.furniture.table.height)}
              fill="#1e293b"
              stroke={PLAN_COLORS.table}
              strokeWidth={1.5}
              rx={3}
            />
            <text
              x={mm(layout.furniture.table.x + layout.furniture.table.width / 2)}
              y={mm(layout.furniture.table.y + layout.furniture.table.height / 2) + 2}
              textAnchor="middle"
              fontSize={6}
              fontWeight={700}
              fill={PLAN_COLORS.table}
            >
              MESA CENTRAL
            </text>
            <rect
              x={mm(layout.furniture.ac.x)}
              y={mm(layout.furniture.ac.y)}
              width={mm(layout.furniture.ac.width)}
              height={mm(layout.furniture.ac.height)}
              fill={PLAN_COLORS.ac}
            />
          </>
        )}
      </g>

      {LEGEND.map((item, i) => {
        const col = i % legendCols;
        const row = Math.floor(i / legendCols);
        const x = PAD_X + col * LEGEND_COL_WIDTH;
        const y = legendTop + row * LEGEND_ROW_HEIGHT;
        return (
          <g key={item.label}>
            <rect x={x} y={y - 8} width={10} height={10} fill={item.fill} stroke="#475569" rx={2} />
            <text x={x + 15} y={y} fontSize={9} fill={PLAN_COLORS.text}>
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
