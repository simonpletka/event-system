/** Small shared line icons. 24-box, stroke=currentColor. */

type IconProps = { size?: number; className?: string };

function Svg({ size = 15, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l.8 12.1a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7M10 11v6M14 11v6" />
    </Svg>
  );
}

/** Two arrows, up and down — sorting. */
export function SortIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />
    </Svg>
  );
}

/** Stacked rows — grouping. */
export function GroupIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <path d="M6 14h12M6 18h8" />
    </Svg>
  );
}

/** Columns — a breakdown / distribution. */
export function ColumnsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 20V9M16 20v-7M12 20V4M20 20V11M4 20v-4" />
    </Svg>
  );
}

/** Arrow into a tray — download. */
export function DownloadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}
