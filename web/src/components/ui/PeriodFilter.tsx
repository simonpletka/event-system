"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listUrl } from "@/lib/list-url";
import type { ProjectPeriod } from "@/lib/queries/projects";

/**
 * Filters the projects list by date range. Unlike FilterSelect's flat
 * option list, "Month"/"Year" need an arbitrary value (not just the current
 * one), so those two rows carry native <input type="month">/<input
 * type="number"> pickers instead of Links — the rest of the shell (trigger
 * pill, dropdown card, outside-click/Escape handling) mirrors FilterSelect.
 */
export function PeriodFilter({
  period,
  month,
  year,
  basePath,
  params,
  t,
}: {
  period?: ProjectPeriod;
  month?: string;
  year?: string;
  basePath: string;
  params: Record<string, string | undefined>;
  t: {
    label: string;
    anyTime: string;
    thisWeek: string;
    future: string;
    past: string;
    monthLabel: string;
    yearLabel: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [flipRight, setFlipRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chromium's segmented month/year inputs fire onChange mid-keystroke —
  // typing "2026" into the year segment can briefly report "0002" before
  // the rest lands. Debounce so only the value once typing settles commits,
  // rather than navigating on that first, still-incomplete keystroke.
  function debounceCommit(fn: () => void) {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(fn, 500);
  }

  useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  function toggle() {
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

  const active = Boolean(period);
  const href = (overrides: { period?: string; month?: string; year?: string }) =>
    listUrl(basePath, params, overrides);

  const selectedLabel =
    period === "week"
      ? t.thisWeek
      : period === "future"
        ? t.future
        : period === "past"
          ? t.past
          : period === "month" && month
            ? formatMonth(month)
            : period === "year" && year
              ? year
              : null;

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
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full border px-3 py-1.5 cursor-pointer transition-colors max-w-[220px] ${
          active
            ? "border-accent/45 bg-accent/8 text-accent"
            : open
              ? "border-ink/35 text-ink"
              : "border-ink/13 text-ink/78 hover:border-ink/30 hover:text-ink"
        }`}
      >
        <span className={`truncate ${selectedLabel ? "" : "text-ink/55"}`}>{selectedLabel ?? t.label}</span>
        {active ? (
          <Link
            href={href({ period: undefined, month: undefined, year: undefined })}
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
          <Link
            href={href({ period: undefined, month: undefined, year: undefined })}
            className={`${item} ${!period ? itemActive : itemIdle}`}
          >
            {t.anyTime}
          </Link>
          <Link
            href={href({ period: "week", month: undefined, year: undefined })}
            className={`${item} ${period === "week" ? itemActive : itemIdle}`}
          >
            {t.thisWeek}
          </Link>
          <Link
            href={href({ period: "future", month: undefined, year: undefined })}
            className={`${item} ${period === "future" ? itemActive : itemIdle}`}
          >
            {t.future}
          </Link>
          <Link
            href={href({ period: "past", month: undefined, year: undefined })}
            className={`${item} ${period === "past" ? itemActive : itemIdle}`}
          >
            {t.past}
          </Link>

          <div className="h-px bg-ink/10 my-0.5" />

          <label className="flex flex-col gap-1 px-0.5">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-ink/40">{t.monthLabel}</span>
            <input
              key={`month-${open}-${period === "month" ? (month ?? "") : ""}`}
              type="month"
              defaultValue={period === "month" ? (month ?? "") : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^\d{4}-\d{2}$/.test(v)) return;
                debounceCommit(() => {
                  router.push(href({ period: "month", month: v, year: undefined }));
                  setOpen(false);
                });
              }}
              className="input !text-[12px] !py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 px-0.5">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-ink/40">{t.yearLabel}</span>
            <input
              key={`year-${open}-${period === "year" ? (year ?? "") : ""}`}
              type="number"
              inputMode="numeric"
              placeholder="2026"
              defaultValue={period === "year" ? (year ?? "") : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^\d{4}$/.test(v)) return;
                debounceCommit(() => {
                  router.push(href({ period: "year", month: undefined, year: v }));
                  setOpen(false);
                });
              }}
              className="input !text-[12px] !py-1.5"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}
