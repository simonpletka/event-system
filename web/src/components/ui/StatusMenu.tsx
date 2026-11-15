"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

export type StatusOption = { value: string; label: string; tone: string };

/**
 * A status chip that opens a menu to change the status in place. The new
 * status shows at once (optimistic) and falls back if the save fails.
 * Clicks never reach what's around it, so it works inside a whole-row link.
 */
export function StatusMenu({
  value,
  options,
  onSelect,
  label,
}: {
  value: string;
  options: StatusOption[];
  /** Saves the new status; resolve false to undo the optimistic change. */
  onSelect: (value: string) => Promise<boolean>;
  /** Accessible name, e.g. "Change status". */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useOptimistic(value);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLSpanElement>(null);
  const current = options.find((o) => o.value === shown) ?? options[0];

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

  function pick(next: string) {
    setOpen(false);
    if (next === shown) return;
    startTransition(async () => {
      setShown(next);
      await onSelect(next);
    });
  }

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      // Inside a row that is itself a link: don't navigate, don't bubble.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={`tag tag-${current.tone} whitespace-nowrap !inline-flex items-center gap-1 cursor-pointer hover:brightness-125 transition ${pending ? "opacity-60" : ""}`}
      >
        {current.label}
        <svg width="8" height="5" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.8" className={`opacity-60 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-full mt-1.5 p-1.5 z-40 flex flex-col gap-0.5 min-w-[170px] shadow-[0_18px_44px_rgba(0,0,0,0.5)]">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === shown}
              onClick={() => pick(o.value)}
              className={`flex items-center justify-between gap-3 w-full text-left text-[13px] leading-6 px-2.5 py-1 rounded-md transition-colors ${
                o.value === shown ? "bg-ink/10" : "hover:bg-ink/8"
              }`}
            >
              <span className={`tag tag-${o.tone} whitespace-nowrap`}>{o.label}</span>
              {o.value === shown && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
