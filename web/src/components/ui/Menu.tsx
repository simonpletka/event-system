"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The app's one dropdown-menu shape — an icon-and-value trigger (bordered,
 * rounded, chevron) and a frosted `.card` popover with rounded items.
 * Controlled open state with click-outside + Escape. Use MenuLink /
 * MenuButton / MenuAnchor for the items.
 */
export function Menu({
  icon,
  value,
  trigger,
  triggerClassName,
  align = "left",
  width = 160,
  children,
}: {
  /** A small line icon that signals what the menu controls (sort, group, …). */
  icon?: ReactNode;
  /** The current selection, shown next to the icon. Ignored if `trigger` is set. */
  value?: ReactNode;
  /** Fully custom trigger content. Pass `triggerClassName` to drop the default styling. */
  trigger?: ReactNode;
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
        className={
          triggerClassName ??
          `inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg border px-2.5 py-1.5 transition-colors ${
            open ? "border-ink/35 text-ink" : "border-ink/13 text-ink/78 hover:border-ink/30 hover:text-ink"
          }`
        }
      >
        {trigger ?? (
          <>
            {icon && <span className="opacity-60 shrink-0 flex">{icon}</span>}
            <span>{value}</span>
            <svg
              width="9"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className={`shrink-0 opacity-55 transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path d="M1 1l4 4 4-4" />
            </svg>
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={`card absolute mt-1.5 p-1.5 z-30 flex flex-col gap-0.5 shadow-[0_18px_44px_rgba(0,0,0,0.5)] ${align === "right" ? "right-0" : "left-0"}`}
          style={{ width }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const ITEM_BASE = "block w-full text-left text-[11.5px] px-2.5 py-1.5 rounded-md transition-colors";
const ITEM_ACTIVE = "bg-ink/10 text-accent font-semibold";
const ITEM_IDLE = "text-ink/72 hover:bg-ink/6 hover:text-ink";

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
