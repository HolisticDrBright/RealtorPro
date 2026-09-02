/** Inline Lucide icons (stroke 2, no fill) — ported from the design prototype. */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 15, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconToday = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="18" rx="0" />
    <path d="M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4" />
  </Base>
);

export const IconScout = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3M8 11h6M11 8v6" />
  </Base>
);

export const IconStudio = (p: IconProps) => (
  <Base {...p}>
    <rect x="2" y="3" width="20" height="18" />
    <path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5" />
  </Base>
);

export const IconPeople = (p: IconProps) => (
  <Base {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Base>
);

export const IconFub = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </Base>
);

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
  </Base>
);

export const IconMic = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
  </Base>
);

export function Spinner({ size = 14, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        border: `2px solid ${onDark ? "var(--color-bg)" : "var(--color-divider)"}`,
        borderTopColor: onDark ? "transparent" : "var(--color-accent)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        display: "inline-block",
        flex: "none",
      }}
    />
  );
}

export const IconOm = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Base>
);

export const IconViz = (p: IconProps) => (
  <Base {...p}>
    <rect x="2" y="2" width="20" height="20" rx="0" />
    <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" />
  </Base>
);

export const IconRent = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="2" width="16" height="20" />
    <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
  </Base>
);

export const IconComp = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 3v18h18" />
    <rect x="7" y="12" width="3" height="6" />
    <rect x="12" y="8" width="3" height="10" />
    <rect x="17" y="5" width="3" height="13" />
  </Base>
);

export const IconSignal = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2a10 10 0 0 1 10 10M12 6a6 6 0 0 1 6 6M4.9 19.1A10 10 0 0 1 2 12" />
  </Base>
);

export const IconDash = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="8" height="8" />
    <rect x="13" y="3" width="8" height="5" />
    <rect x="13" y="10" width="8" height="11" />
    <rect x="3" y="13" width="8" height="8" />
  </Base>
);
