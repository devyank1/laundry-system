import type { ReactNode } from "react";

// Ícones de traço (24x24, stroke 1.75) no lugar dos emojis da interface.
// Decorativos: o nome acessível vem sempre do texto do botão.

function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconPlan = () => (
  <Svg>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 10h7v11M14 3v7h7" />
  </Svg>
);

export const IconCube = () => (
  <Svg>
    <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
    <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
  </Svg>
);

export const IconChart = () => (
  <Svg>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 6-6" />
    <path d="M16 8h4v4" />
  </Svg>
);

export const IconSignal = () => (
  <Svg>
    <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
    <path d="M2 9a14.5 14.5 0 0 1 20 0" />
    <circle cx="12" cy="19.5" r="1" fill="currentColor" />
  </Svg>
);

export const IconSettings = () => (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);

export const IconDownload = () => (
  <Svg>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);

export const IconEye = () => (
  <Svg>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconSparkles = () => (
  <Svg>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1" />
  </Svg>
);

export const IconOrbit = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M3 12a9 4 0 1 0 18 0 9 4 0 1 0-18 0" />
  </Svg>
);

// Ícones dos títulos do painel lateral
export const IconRuler = () => (
  <Svg>
    <path d="M3 17 17 3l4 4L7 21z" />
    <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
  </Svg>
);

export const IconWasher = () => (
  <Svg>
    <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
    <path d="M4 7h16" />
    <circle cx="12" cy="14" r="4" />
    <circle cx="7.5" cy="4.8" r="0.6" fill="currentColor" />
  </Svg>
);

export const IconSofa = () => (
  <Svg>
    <path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
    <path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M6 19v2M18 19v2" />
  </Svg>
);

export const IconInfo = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.5" />
  </Svg>
);

export const IconImage = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="m21 16-5-5-9 9" />
  </Svg>
);

export const IconStore = () => (
  <Svg>
    <path d="M4 9.5V20h16V9.5" />
    <path d="M2.5 9.5 4.5 4h15l2 5.5a2.8 2.8 0 0 1-5 1.5 2.8 2.8 0 0 1-4.5 0 2.8 2.8 0 0 1-4.5 0 2.8 2.8 0 0 1-5-1.5z" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const IconBulb = () => (
  <Svg>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
  </Svg>
);

// Marca do produto: tambor de lavadora estilizado.
export function LogoMark() {
  return (
    <svg className="logo-mark" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="8" y="6.5" width="16" height="19" rx="2.5" fill="none" style={{ stroke: "var(--logo-ink, #fff)" }} strokeWidth="1.6" />
      <line x1="8" y1="11" x2="24" y2="11" style={{ stroke: "var(--logo-ink, #fff)" }} strokeWidth="1.6" />
      <circle cx="16" cy="18.25" r="4.25" fill="none" style={{ stroke: "var(--logo-ink, #fff)" }} strokeWidth="1.6" />
      <circle cx="11" cy="8.75" r="0.9" style={{ fill: "var(--logo-ink, #fff)" }} />
    </svg>
  );
}
