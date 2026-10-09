import { forwardRef } from "react";
import type { Layout } from "../engine/types";

const SCALE = 0.08; // px por mm

function mm(value: number): number {
  return value * SCALE;
}

export const FloorPlan = forwardRef<SVGSVGElement, { layout: Layout }>(function FloorPlan(
  { layout },
  ref
) {
  const width = mm(layout.roomWidthMm);
  const height = mm(layout.roomDepthMm);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Planta baixa da lavanderia"
    >
      <rect x={0} y={0} width={width} height={height} fill="#f7f7f5" stroke="#333" strokeWidth={2} />

      {layout.machines.map((machine) => (
        <rect
          key={`${machine.catalogId}-${machine.instanceIndex}`}
          x={mm(machine.x)}
          y={mm(machine.y)}
          width={mm(machine.widthMm)}
          height={mm(machine.depthMm)}
          fill="#9fb8d9"
          stroke="#1f3a5f"
        />
      ))}

      <line
        x1={0}
        y1={mm(layout.drywall.y)}
        x2={mm(layout.techCorridor.x)}
        y2={mm(layout.drywall.y)}
        stroke="#8a5a2b"
        strokeWidth={4}
      />
      <line
        x1={mm(layout.techCorridor.x + layout.techCorridor.width)}
        y1={mm(layout.drywall.y)}
        x2={width}
        y2={mm(layout.drywall.y)}
        stroke="#8a5a2b"
        strokeWidth={4}
      />
      {layout.drywall.openings.map((o, i) => (
        <rect
          key={i}
          x={mm(o.x)}
          y={mm(layout.drywall.y) - 2}
          width={mm(o.width)}
          height={4}
          fill="#f7f7f5"
        />
      ))}

      <rect
        x={mm(layout.techCorridor.x)}
        y={mm(layout.techCorridor.y)}
        width={mm(layout.techCorridor.width)}
        height={mm(layout.techCorridor.height)}
        fill="none"
        stroke="#999"
        strokeDasharray="6 4"
      />

      {layout.frontDoor && (
        <>
          <line
            x1={mm(layout.frontDoor.x)}
            y1={height}
            x2={mm(layout.frontDoor.x + layout.frontDoor.width)}
            y2={height}
            stroke="#f7f7f5"
            strokeWidth={4}
          />
          <path
            d={`M ${mm(layout.frontDoor.x)} ${height} A ${mm(layout.frontDoor.width)} ${mm(
              layout.frontDoor.width
            )} 0 0 1 ${mm(layout.frontDoor.x + layout.frontDoor.width)} ${
              height - mm(layout.frontDoor.width)
            }`}
            fill="none"
            stroke="#1f3a5f"
            strokeDasharray="4 3"
          />
        </>
      )}

      {layout.furniture && (
        <>
          <rect
            x={mm(layout.furniture.totem.x)}
            y={mm(layout.furniture.totem.y)}
            width={mm(layout.furniture.totem.width)}
            height={mm(layout.furniture.totem.height)}
            fill="#333333"
          />
          <rect
            x={mm(layout.furniture.table.x)}
            y={mm(layout.furniture.table.y)}
            width={mm(layout.furniture.table.width)}
            height={mm(layout.furniture.table.height)}
            fill="#c9a97a"
          />
          {layout.furniture.chairs.map((c, i) => (
            <rect
              key={i}
              x={mm(c.x)}
              y={mm(c.y)}
              width={mm(c.width)}
              height={mm(c.height)}
              fill="#d9c7a3"
            />
          ))}
          <rect
            x={mm(layout.furniture.ac.x)}
            y={mm(layout.furniture.ac.y)}
            width={mm(layout.furniture.ac.width)}
            height={mm(layout.furniture.ac.height)}
            fill="#7fb3d5"
          />
        </>
      )}

      <text x={8} y={height - 8} fontSize={12} fill="#333">
        {(layout.roomWidthMm / 1000).toFixed(2)}m x {(layout.roomDepthMm / 1000).toFixed(2)}m
      </text>
    </svg>
  );
});
