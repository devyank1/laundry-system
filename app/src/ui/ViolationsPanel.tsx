import { useProjectStore } from "../state/projectStore";
import type { Violation } from "../engine/types";

export function ViolationsPanel({ violations }: { violations: Violation[] }) {
  const state = useProjectStore();
  if (violations.length === 0) return null;

  function applySuggestion(v: Violation): void {
    if (v.field === "roomWidthMm") state.setRoomWidthMm(v.suggestedValueMm);
    else if (v.field === "roomDepthMm") state.setRoomDepthMm(v.suggestedValueMm);
    else if (v.field === "ceilingHeightMm") state.setCeilingHeightMm(v.suggestedValueMm);
  }

  return (
    <ul role="alert" aria-label="Avisos de dimensionamento">
      {violations.map((v) => (
        <li key={v.code}>
          {v.message}
          {v.field !== "machines" && (
            <button type="button" onClick={() => applySuggestion(v)}>
              Aplicar sugestão
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
