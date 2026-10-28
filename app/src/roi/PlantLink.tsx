import { plantSummary, type PlantMachine } from "../plantLink";

// Faixa "Planta: 3× Speed Queen ..." no topo das calculadoras: mostra se os
// números estão iguais à planta 2D/3D e deixa reaplicar com um clique.
export function PlantLink({
  plant,
  matches,
  onApply,
  detail,
}: {
  plant: PlantMachine[];
  matches: boolean;
  onApply: () => void;
  /** o que a planta vira aqui (ex.: "6 bocas pequenas") */
  detail?: string;
}) {
  return (
    <div className={matches ? "roi-plant roi-plant-ok" : "roi-plant roi-plant-diff"} role="status">
      <div>
        <strong>Planta: {plantSummary(plant)}</strong>
        <span>
          {matches ? "Cálculo igual à planta" : "Cálculo diferente da planta (ajustado à mão)"}
          {detail ? ` · ${detail}` : ""}
        </span>
      </div>
      <button type="button" onClick={onApply} disabled={matches}>
        Ajustar à planta
      </button>
    </div>
  );
}
