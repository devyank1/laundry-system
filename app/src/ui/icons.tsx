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

// Marca do produto: tambor de lavadora estilizado.
export function LogoMark() {
  return (
    <svg className="logo-mark" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="8" y="6.5" width="16" height="19" rx="2.5" fill="none" stroke="#fff" strokeWidth="1.6" />
      <line x1="8" y1="11" x2="24" y2="11" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16" cy="18.25" r="4.25" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="11" cy="8.75" r="0.9" fill="#fff" />
    </svg>
  );
}
