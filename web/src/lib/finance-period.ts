import { addDays, isoDate, parseIsoDate, startOfDay } from "@/lib/calendar";
import type { Locale } from "@/lib/dictionary";

/**
 * Period model for the finance report. Separate from the time tracker's
 * `day | week | month | year` (`lib/queries/timetracker.ts`) on purpose — an
 * accountant reconciles by VAT period (month or quarter), a whole year, or an
 * ad-hoc range, never by ISO week.
 */
export type ReportPeriod = "month" | "quarter" | "year" | "custom";

/** Half-open `[from, to)` — `to` is exclusive. */
export type ResolvedRange = { from: Date; to: Date };

const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", cs: "cs-CZ" };

export function resolveRange(
  period: ReportPeriod,
  anchorIso: string | undefined,
  fromIso?: string,
  toIso?: string,
): ResolvedRange {
  if (period === "custom") {
    const from = startOfDay(fromIso ? parseIsoDate(fromIso) : new Date());
    const toIncRaw = startOfDay(toIso ? parseIsoDate(toIso) : new Date());
    const toInc = toIncRaw < from ? from : toIncRaw;
    return { from, to: addDays(toInc, 1) };
  }
  const anchor = startOfDay(anchorIso ? parseIsoDate(anchorIso) : new Date());
  const y = anchor.getFullYear();
  if (period === "year") return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
  if (period === "quarter") {
    const q = Math.floor(anchor.getMonth() / 3);
    return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 1) };
  }
  const m = anchor.getMonth();
  return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
}

/** Move the anchor one period back/forward. No-op semantics for `custom` (the UI hides the stepper there). */
export function stepAnchor(period: ReportPeriod, anchorIso: string | undefined, dir: 1 | -1): string {
  const d = startOfDay(anchorIso ? parseIsoDate(anchorIso) : new Date());
  if (period === "year") d.setFullYear(d.getFullYear() + dir);
  else if (period === "quarter") d.setMonth(d.getMonth() + dir * 3);
  else d.setMonth(d.getMonth() + dir);
  return isoDate(d);
}

export type ReportBucket = { label: string; start: Date; end: Date };

/**
 * Chart buckets for `[from, to)`: one per day for a span up to ~6 weeks
 * (a single month, a short custom range), otherwise one per calendar month
 * (a quarter, a year, a long custom range), clipped to the actual range.
 */
export function reportBuckets(from: Date, to: Date, locale: Locale): ReportBucket[] {
  const loc = INTL_LOCALE[locale];
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (days <= 45) {
    const dayFmt = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" });
    const out: ReportBucket[] = [];
    for (let d = new Date(from); d < to; d = addDays(d, 1)) {
      out.push({ label: dayFmt.format(d), start: new Date(d), end: addDays(d, 1) });
    }
    return out;
  }
  const monthFmt = new Intl.DateTimeFormat(loc, { month: "short" });
  const out: ReportBucket[] = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor < to) {
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    out.push({
      label: monthFmt.format(cursor),
      start: cursor < from ? from : new Date(cursor),
      end: end > to ? to : end,
    });
    cursor = end;
  }
  return out;
}

export function rangeLabel(period: ReportPeriod, from: Date, to: Date, locale: Locale): string {
  const loc = INTL_LOCALE[locale];
  const y = from.getFullYear();
  if (period === "year") return String(y);
  if (period === "quarter") return `Q${Math.floor(from.getMonth() / 3) + 1} ${y}`;
  if (period === "month") return new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }).format(from);
  const fmt = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(from)} – ${fmt.format(addDays(to, -1))}`;
}
