import type { ReactNode } from "react";

/** Título de bloco do painel lateral: ícone, nome e um resumo curto à direita. */
export function SectionTitle({ icon, children, chip }: { icon: ReactNode; children: ReactNode; chip?: ReactNode }) {
  return (
    <legend className="sec-title">
      <span className="sec-ic" aria-hidden="true">
        {icon}
      </span>
      <span className="sec-name">{children}</span>
      {chip !== undefined && chip !== null && chip !== "" && <em className="sec-chip">{chip}</em>}
    </legend>
  );
}
