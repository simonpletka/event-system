"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { listUrl } from "@/lib/list-url";

type Option = { value: string; label: string };

/**
 * Single-select filter dropdown — replaces a native <select> so the menu
 * matches the rest of the app (frosted card, rounded items) instead of the
 * OS list. Picking an option navigates immediately, carrying the other list
 * params. Option-F trigger; turns accent when a value is set, with an ×.
 */
export function FilterSelect({
  icon,
  label,
  value,
  options,
  basePath,
  params,
  paramName,
  searchable = false,
  searchPlaceholder,
  emptyLabel,
  anyLabel,
}: {
  icon?: ReactNode;
  /** Shown on the trigger when nothing is selected. */
  label: string;
  value: string;
  options: Option[];
  basePath: string;
  params: Record<string, string | undefined>;
  paramName: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** The "clear the filter" option at the top of the list. Omit for a
   *  picker that always has a value (e.g. a year), which then shows no ×. */
  anyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [flipRight, setFlipRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function toggle() {
    setQ("");
    if (!open) {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) setFlipRight(rect.left + 240 + 12 > window.innerWidth);
    }
    setOpen((o) => !o);
  }

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

  const selected = options.find((o) => o.value === value);
  const active = value !== "";
  // A year-style picker (no anyLabel) always has a value — don't paint it as
  // an "active filter".
  const activeStyle = Boolean(anyLabel) && active;
  const showClear = Boolean(anyLabel) && active;
  const href = (v: string) => listUrl(basePath, params, { [paramName]: v || undefined });
  const shown =
    searchable && q.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
      : options;

  const item = "block shrink-0 text-[13px] leading-6 px-2.5 py-1.5 rounded-md transition-colors truncate";
  const itemActive = "bg-ink/10 text-accent font-semibold";
  const itemIdle = "text-ink/85 hover:bg-ink/8 hover:text-ink";

  return (
    <div ref={ref} className="relative shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors max-w-[220px] ${
          activeStyle
            ? "border-accent/45 bg-accent/8 text-accent"
            : open
              ? "border-ink/35 text-ink"
              : "border-ink/13 text-ink/78 hover:border-ink/30 hover:text-ink"
        }`}
      >
        {icon && <span className="opacity-60 shrink-0 flex">{icon}</span>}
        <span className={`truncate ${selected ? "" : "text-ink/55"}`}>{selected ? selected.label : label}</span>
        {showClear ? (
          <Link
            href={href("")}
            onClick={(e) => e.stopPropagation()}
            aria-label="Clear"
            className="shrink-0 -mr-0.5 leading-none opacity-70 hover:opacity-100"
          >
            ×
          </Link>
        ) : (
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
        )}
      </div>

      {open && (
        <div
          className={`card absolute mt-1.5 p-1.5 z-30 w-[240px] flex flex-col gap-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.5)] ${
            flipRight ? "right-0" : "left-0"
          }`}
        >
          {searchable && (
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="input !text-[12px] !py-2"
            />
          )}
          <div className="flex flex-col max-h-[300px] overflow-y-auto -mx-0.5 px-0.5">
            {anyLabel && (
              <Link href={href("")} className={`${item} ${!active ? itemActive : itemIdle}`}>
                {anyLabel}
              </Link>
            )}
            {shown.map((o) => (
              <Link key={o.value} href={href(o.value)} className={`${item} ${o.value === value ? itemActive : itemIdle}`}>
                {o.label}
              </Link>
            ))}
            {shown.length === 0 && <div className="text-[11px] placeholder-text px-2.5 py-2">{emptyLabel}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
