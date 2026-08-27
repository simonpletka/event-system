import type { ReactNode } from "react";

/**
 * "···" overflow menu for row actions that shouldn't sit inline on every row
 * — chiefly destructive ones. Uses the same bare <details> popover pattern as
 * the rest of the app (no JS); the menu stays open until toggled again, which
 * is fine for a rarely-used menu. Children are the menu items — style them
 * with the .menu-item class.
 */
export function RowActions({ children, menuLabel }: { children: ReactNode; menuLabel: string }) {
  return (
    <details className="relative shrink-0">
      <summary
        aria-label={menuLabel}
        className="list-none cursor-pointer w-7 h-7 grid place-items-center rounded-md text-ink/45 hover:text-ink hover:bg-ink/8 [&::-webkit-details-marker]:hidden"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </summary>
      <div className="card absolute right-0 mt-1 p-1 z-30 min-w-[132px] flex flex-col shadow-[0_14px_36px_rgba(0,0,0,0.45)]">
        {children}
      </div>
    </details>
  );
}
