// Placeholder brand mark until the real logo exists. Swap the <svg> for the
// final artwork and every place that renders <Logo> picks it up.
// The tile follows --color-accent, so a customized accent recolors it too.

import { useId } from "react";

export function LogoMark({ size = 40, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  // Unique per instance: two marks on one page must not share a gradient id.
  const gradientId = `logo-tile-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="Logo"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          {/* CSS variables only resolve through style, not presentation attributes. */}
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--color-accent) 72%, white)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-accent)" }} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />
      <rect x="0.5" y="0.5" width="39" height="39" rx="10.5" fill="none" stroke="white" strokeOpacity="0.22" />
      {/* Abstract "P": a stem and a bowl, with a dot for the active project. */}
      <path d="M13 29V11h8a6 6 0 0 1 0 12h-8" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27.5" cy="28.5" r="2.2" fill="white" />
    </svg>
  );
}

export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className="text-[11px] font-bold tracking-[0.16em] leading-none">PROJECT SYSTEM</span>
    </span>
  );
}
