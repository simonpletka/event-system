"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The app's one dropdown-menu shape — a `.btno` trigger and a `.card` popover
 * with rounded items, matching the Time Tracker report's "Breakdown by" menu.
 * Controlled open state with click-outside + Escape (a bare <details> can't
 * close on outside click). Use MenuLink / MenuButton for the items.
 */
export function Menu({
  triggerLabel,
  triggerValue,
  trigger,
  triggerClassName,
  align = "left",
  width = 150,
  children,
}: {
  /** Dim prefix shown before the value, e.g. "Sort" → renders "Sort:". */
  triggerLabel?: string;
  /** The current selection, shown bold. Ignored if `trigger` is given. */
  triggerValue?: ReactNode;
  /** Fully custom trigger content. Pass `triggerClassName` to drop the .btno pill. */
  trigger?: ReactNode;
  /** Overrides the default `.btno` trigger styling. */
  triggerClassName?: string;
  align?: "left" | "right";
  width?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0" onClick={() => setOpen(false)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={triggerClassName ?? "btno text-[9px] flex items-center gap-1.5"}
      >
        {trigger ?? (
          <>
            {triggerLabel && <span className="placeholder-text normal-case tracking-normal">{triggerLabel}:</span>}
            <span className="font-semibold">{triggerValue}</span>
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={`card absolute mt-1.5 p-1.5 z-30 flex flex-col gap-0.5 shadow-[0_14px_36px_rgba(0,0,0,0.4)] ${align === "right" ? "right-0" : "left-0"}`}
          style={{ width }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const ITEM_BASE = "block w-full text-left text-[11px] px-2.5 py-1.5 rounded-md transition-colors";
const ITEM_ACTIVE = "bg-ink/10 text-accent font-semibold";
const ITEM_IDLE = "text-ink/70 hover:bg-ink/5 hover:text-ink";

export function MenuLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link href={href} role="menuitem" className={`${ITEM_BASE} ${active ? ITEM_ACTIVE : ITEM_IDLE}`}>
      {children}
    </Link>
  );
}

export function MenuButton({ onClick, active, children }: { onClick?: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`${ITEM_BASE} ${active ? ITEM_ACTIVE : ITEM_IDLE}`}>
      {children}
    </button>
  );
}

export function MenuAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" role="menuitem" className={`${ITEM_BASE} ${ITEM_IDLE}`}>
      {children}
    </a>
  );
}
