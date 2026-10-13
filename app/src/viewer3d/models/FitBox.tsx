import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Box3, Matrix4, Vector3, type Group } from "three";

// Encaixa um modelo (em medidas nativas) numa caixa alvo [w, h, d] em metros,
// com a base em y=0 e centralizado em x/z.
// - "stretch": escala cada eixo para preencher a caixa exatamente.
// - "height": escala uniforme pela altura; o fundo (z mínimo) encosta no fundo da caixa.
export function FitBox({
  size,
  mode = "stretch",
  children,
}: {
  size: [number, number, number];
  mode?: "stretch" | "height";
  children: ReactNode;
}) {
  const fitRef = useRef<Group>(null);
  const contentRef = useRef<Group>(null);
  const [w, h, d] = size;

  useLayoutEffect(() => {
    const fit = fitRef.current;
    const content = contentRef.current;
    if (!fit) return;
    if (!content) return;

    fit.position.set(0, 0, 0);
    fit.scale.set(1, 1, 1);
    fit.updateMatrixWorld(true);
    const box = new Box3().setFromObject(content);
    if (box.isEmpty()) return;
    box.applyMatrix4(new Matrix4().copy(fit.matrixWorld).invert());

    const native = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    if (mode === "stretch") {
      const sx = w / native.x;
      const sy = h / native.y;
      const sz = d / native.z;
      fit.scale.set(sx, sy, sz);
      fit.position.set(-center.x * sx, -box.min.y * sy, -center.z * sz);
    } else {
      const s = h / native.y;
      fit.scale.setScalar(s);
      fit.position.set(-center.x * s, -box.min.y * s, -d / 2 - box.min.z * s);
    }
  }, [w, h, d, mode]);

  return (
    <group ref={fitRef}>
      <group ref={contentRef}>{children}</group>
    </group>
  );
}
