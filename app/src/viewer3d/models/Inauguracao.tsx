import type { Layout } from "../../engine/types";
import { placeInauguracao } from "../inauguracao";
import { BalloonArch } from "./BalloonArch";
import { KeepsakeTable } from "./KeepsakeTable";
import { PopcornCart } from "./PopcornCart";

// Itens de festa da inauguração (arco, pipoca, mesa de lembranças). Posições
// vêm de placeInauguracao, ancoradas na fachada.
export function Inauguracao({ layout }: { layout: Layout }) {
  const p = placeInauguracao(layout);

  return (
    <>
      <group position={[p.arch.x, 0, p.arch.z]}>
        <BalloonArch />
      </group>
      <group position={[p.cart.x, 0, p.cart.z]}>
        <PopcornCart />
      </group>
      <group position={[p.keepsakeTable.x, 0, p.keepsakeTable.z]}>
        <KeepsakeTable />
      </group>
    </>
  );
}
