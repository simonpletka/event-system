"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { formatDay, formatDayRange, freeTone, normalize } from "./shared";
import { ConditionChip } from "./ConditionChip";

export type AvailabilityRow = {
  id: string;
  name: string;
  categoryId: string;
  /** Usable units today. */
  total: number;
  /** Usable units per day: each day's count is out of this. */
  usable: number[];
  free: number[];
  units: {
    id: string;
    number: number;
    condition: string;
    /** Days the unit is out of use (damaged, in service…). */
    out: boolean[];
    bars: { from: number; to: number; project: string | null; number: string; note: string; overdue: boolean }[];
  }[];
};

const CELL: Record<ReturnType<typeof freeTone>, string> = {
  positive: "bg-positive/14 text-positive",
  attention: "bg-attention/16 text-attention",
  warning: "bg-warning/18 text-warning",
  neutral: "bg-ink/5 placeholder-text",
};

const COLS = "grid grid-cols-[minmax(170px,220px)_repeat(14,minmax(44px,1fr))]";

/** 14 days × types, free units per day. A type opens into its units with booking bars. */
export function AvailabilityGrid({
  days,
  today,
  categories,
  rows,
  prevHref,
  nextHref,
  todayHref,
  locale,
}: {
  days: string[];
  today: string;
  categories: { id: string; name: string }[];
  rows: AvailabilityRow[];
  prevHref: string;
  nextHref: string;
  todayHref: string | null;
  locale: Locale;
}) {
  const t = getDictionary(locale).gear;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const q = normalize(query.trim());
  const shown = q ? rows.filter((r) => normalize(r.name).includes(q) || normalize(categoryName.get(r.categoryId) ?? "").includes(q)) : rows;
  const sections = categories.map((c) => ({ category: c, rows: shown.filter((r) => r.categoryId === c.id) })).filter((s) => s.rows.length > 0);
  const weekend = (key: string) => {
    const wd = new Date(`${key}T12:00:00Z`).getUTCDay();
    return wd === 0 || wd === 6;
  };

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const dayTint = (key: string) => `${key === today ? "bg-accent/10" : ""} ${weekend(key) ? "opacity-60" : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchShort}
          aria-label={t.searchShort}
          className="input flex-1 min-w-[220px] max-w-[420px]"
        />
        <div className="flex items-center gap-2">
          <Link href={prevHref} scroll={false} aria-label={t.prev2} title={t.prev2} className="grid place-items-center w-10 h-10 rounded-full border border-ink/16 hover:bg-ink/10">
            ‹
          </Link>
          <span className="text-[14px] font-semibold tabular-nums min-w-[150px] text-center">
            {formatDayRange(days[0], days[days.length - 1], locale)} {days[days.length - 1].slice(0, 4)}
          </span>
          <Link href={nextHref} scroll={false} aria-label={t.next2} title={t.next2} className="grid place-items-center w-10 h-10 rounded-full border border-ink/16 hover:bg-ink/10">
            ›
          </Link>
          {todayHref && (
            <Link href={todayHref} scroll={false} className="btno !text-[10px]">
              {t.today}
            </Link>
          )}
        </div>
      </div>

      <section aria-label={t.tabAvailability} className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div role="table" className="min-w-[820px]">
            <div role="row" className={`${COLS} border-b border-ink/10`}>
              <div role="columnheader" className="sticky left-0 z-[2] bg-surface px-4 py-3 heading-label !text-[10px] flex items-end">
                {t.colGear}
              </div>
              {days.map((key) => (
                <div role="columnheader" key={key} className={`py-2.5 text-center text-[11px] leading-tight ${dayTint(key)}`}>
                  <span className="placeholder-text">{formatDay(key, locale, { weekday: "short" })}</span>
                  <br />
                  <span className={`text-[14px] font-bold ${key === today ? "inline-grid place-items-center min-w-[26px] h-[26px] mt-0.5 rounded-full bg-accent text-white" : ""}`}>
                    {formatDay(key, locale, { day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>

            {sections.length === 0 && <p className="px-4 py-5 text-[13px] placeholder-text">{rows.length === 0 ? t.empty : t.noMatch}</p>}

            {sections.map(({ category, rows: sectionRows }) => (
              <Fragment key={category.id}>
                <div className="sticky left-0 w-fit px-4 pt-4 pb-1.5 text-[11px] font-bold tracking-[0.08em] uppercase text-ink/70">{category.name}</div>
                {sectionRows.map((r) => {
                  const expanded = open.has(r.id);
                  return (
                    <Fragment key={r.id}>
                      <div role="row" className={`${COLS} border-t border-ink/8`}>
                        <div role="rowheader" className="sticky left-0 z-[1] bg-surface px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => toggle(r.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? t.hideUnits(r.name) : t.showUnits(r.name)}
                            className="w-full flex items-center gap-2 px-2 min-h-[40px] rounded-xl text-left hover:bg-ink/5"
                          >
                            <span aria-hidden className={`text-[10px] placeholder-text transition-transform ${expanded ? "rotate-90" : ""}`}>
                              ▶
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13.5px] font-semibold truncate">{r.name}</span>
                              <span className="block text-[11.5px] placeholder-text">{t.unitsCount(r.total)}</span>
                            </span>
                          </button>
                        </div>
                        {r.free.map((n, i) => {
                          const tone = freeTone(n, r.usable[i]);
                          return (
                            <div role="cell" key={days[i]} className={`p-1 ${days[i] === today ? "bg-accent/10" : ""}`}>
                              <div
                                title={t.freeOn(n, r.usable[i], formatDay(days[i], locale, { weekday: "short", day: "numeric", month: "short" }))}
                                className={`h-full min-h-[36px] grid place-items-center rounded-lg text-[14px] font-bold tabular-nums ${CELL[tone]} ${weekend(days[i]) ? "opacity-60" : ""}`}
                              >
                                {n}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {expanded &&
                        r.units.map((u) => (
                          <div role="row" key={u.id} className={`${COLS} min-h-[38px]`}>
                            <div role="rowheader" className="sticky left-0 z-[1] bg-surface pl-11 pr-2 flex items-center gap-2 text-[12.5px] placeholder-text">
                              {t.unitLabel(u.number)}
                              {u.condition !== "OK" && <ConditionChip condition={u.condition} locale={locale} />}
                            </div>
                            <div className="col-[2/-1] grid grid-cols-[repeat(14,minmax(44px,1fr))] items-center py-1">
                              {u.out.map((isOut, i) =>
                                isOut ? (
                                  <div
                                    key={`out-${i}`}
                                    aria-hidden
                                    title={t.condition[u.condition]}
                                    style={{ gridColumn: `${i + 1} / ${i + 2}`, gridRow: 1 }}
                                    className="mx-0.5 h-[28px] rounded-md bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--color-warning)_40%,transparent)_0_5px,transparent_5px_10px)]"
                                  />
                                ) : null
                              )}
                              {u.bars.map((b, i) => (
                                <div
                                  key={i}
                                  role="cell"
                                  style={{ gridColumn: `${b.from + 1} / ${b.to + 2}`, gridRow: 1 }}
                                  title={b.project ? `${b.number} ${b.project}` : b.note || t.noProject}
                                  className={`mx-1 h-[28px] rounded-lg text-[11.5px] font-semibold px-2 flex items-center truncate ${
                                    b.overdue ? "bg-warning/70 text-white" : b.project ? "bg-accent/55 text-white" : "border border-dashed border-ink/40 bg-ink/10 text-ink/85"
                                  }`}
                                >
                                  <span className="truncate">{b.project ?? (b.note || t.noProject)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] placeholder-text">
        <span className="inline-flex items-center gap-2">
          <span className={`inline-grid place-items-center w-7 h-6 rounded-md font-bold ${CELL.positive}`}>3</span> {t.legendAll}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={`inline-grid place-items-center w-7 h-6 rounded-md font-bold ${CELL.attention}`}>1</span> {t.legendSome}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={`inline-grid place-items-center w-7 h-6 rounded-md font-bold ${CELL.warning}`}>0</span> {t.legendNone}
        </span>
        <span>{t.legendNote}</span>
      </div>
    </div>
  );
}
