"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MiniCalendar } from "@/components/calendar/MiniCalendar";
import { addDays, isoDate, mondayOf, parseIsoDate, rangeLabel, weekLabel } from "@/lib/calendar";

/**
 * Deliberately plain-data props only (ISO date strings, a base path, a raw
 * query string) — this is rendered from a Server Component page, which can
 * never pass function props across to a Client Component. `basePath` +
 * `extraQuery` let the same component serve both the tracking page's
 * Calendar nav (single-day picker → jumps to that day's week) and its List
 * nav (two-click range picker), each preserving its own other query params.
 */
type Props =
  | { mode: "single"; weekStartIso: string; basePath: string; extraQuery?: string; todayLabel: string }
  | { mode: "range"; fromIso: string; toIso: string; basePath: string; extraQuery?: string; todayLabel: string };

function buildHref(basePath: string, extraQuery: string | undefined, params: Record<string, string>) {
  const qs = new URLSearchParams(extraQuery ?? "");
  for (const [k, v] of Object.entries(params)) qs.set(k, v);
  const s = qs.toString();
  return `${basePath}${s ? `?${s}` : ""}`;
}

export function DateNav(props: Props) {
  const router = useRouter();
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

  let label: string;
  let prevHref: string;
  let nextHref: string;
  let todayHref: string;
  let initialMonth: Date;

  if (props.mode === "single") {
    const weekStart = parseIsoDate(props.weekStartIso);
    label = weekLabel(weekStart);
    prevHref = buildHref(props.basePath, props.extraQuery, { week: isoDate(addDays(weekStart, -7)) });
    nextHref = buildHref(props.basePath, props.extraQuery, { week: isoDate(addDays(weekStart, 7)) });
    todayHref = buildHref(props.basePath, props.extraQuery, { week: isoDate(mondayOf(new Date())) });
    initialMonth = weekStart;
  } else {
    const from = parseIsoDate(props.fromIso);
    const toInclusive = parseIsoDate(props.toIso);
    const rangeDays = Math.round((toInclusive.getTime() - from.getTime()) / 86400000) + 1;
    label = rangeLabel(from, toInclusive);
    prevHref = buildHref(props.basePath, props.extraQuery, {
      from: isoDate(addDays(from, -rangeDays)),
      to: isoDate(addDays(toInclusive, -rangeDays)),
    });
    nextHref = buildHref(props.basePath, props.extraQuery, {
      from: isoDate(addDays(from, rangeDays)),
      to: isoDate(addDays(toInclusive, rangeDays)),
    });
    const todayFrom = mondayOf(new Date());
    todayHref = buildHref(props.basePath, props.extraQuery, { from: isoDate(todayFrom), to: isoDate(addDays(todayFrom, 6)) });
    initialMonth = toInclusive;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <div className="flex items-center gap-1.5">
        <Link href={prevHref} className="btno px-2 py-1.5">
          ←
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="btno px-3 py-1.5 inline-flex items-center gap-1.5"
        >
          <CalendarGlyph />
          <span className="text-[10px] tracking-[0.1em] uppercase whitespace-nowrap">{label}</span>
        </button>
        <Link href={nextHref} className="btno px-2 py-1.5">
          →
        </Link>
        <Link href={todayHref} className="btno" onClick={() => setOpen(false)}>
          {props.todayLabel}
        </Link>
      </div>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30">
          {props.mode === "single" ? (
            <MiniCalendar
              initialMonth={initialMonth}
              picker={{
                mode: "single",
                active: parseIsoDate(props.weekStartIso),
                hrefFor: (day) => buildHref(props.basePath, props.extraQuery, { week: isoDate(mondayOf(day)) }),
              }}
            />
          ) : (
            <MiniCalendar
              initialMonth={initialMonth}
              picker={{
                mode: "range",
                rangeStart: parseIsoDate(props.fromIso),
                rangeEnd: parseIsoDate(props.toIso),
                onCommit: (a, b) => {
                  router.push(buildHref(props.basePath, props.extraQuery, { from: isoDate(a), to: isoDate(b) }));
                },
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
