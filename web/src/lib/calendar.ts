export function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Monday of the week containing `d`. */
export function mondayOf(d: Date) {
  const day = (d.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  return startOfDay(addDays(d, -day));
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function weekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Parses a "YYYY-MM-DD" as a local calendar day. Deliberately not
 * `new Date(string)` — bare date strings parse as UTC midnight, which is a
 * different local calendar day for negative UTC offsets (see isoDate below
 * for the matching bug on the way out).
 */
export function parseIsoDate(s: string) {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/**
 * Local-calendar-day YYYY-MM-DD. Deliberately not `toISOString().slice(0,10)`
 * — that converts to UTC first, which silently rolls the date back a day for
 * any positive UTC offset (bit the week-nav "Today" link once already).
 */
export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local-time HH:MM, for prefilling a `<input type="time">`. */
export function isoTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const DAY_LABEL = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function dayHeaderLabel(d: Date) {
  return `${DAY_LABEL[(d.getDay() + 6) % 7]} ${d.getDate()}`;
}

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short month name for a date's month ("Jan".."Dec") — the year-view bucket label. */
export function monthHeaderLabel(d: Date) {
  return MONTH_LABEL[d.getMonth()];
}

/** First-of-month local Dates for all 12 months of `yearDate`'s year. */
export function monthsOfYear(yearDate: Date) {
  return Array.from({ length: 12 }, (_, i) => new Date(yearDate.getFullYear(), i, 1));
}

export function weekLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const startMonth = weekStart.toLocaleDateString("en-GB", { month: "short" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "short" });
  const range =
    startMonth === endMonth
      ? `${weekStart.getDate()}–${end.getDate()} ${endMonth} ${end.getFullYear()}`
      : `${weekStart.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
  return `Week ${isoWeekNumber(weekStart)} · ${range}`;
}

/**
 * Same shape as weekLabel but for an arbitrary [from, toInclusive] span —
 * used by the tracker's date-range nav, where the range isn't necessarily a
 * single calendar week. Always suffixed with the start date's ISO week
 * number regardless of the span's actual length (matches the reference
 * design, which keeps showing "· W34" even for an 11-day custom range).
 */
export function rangeLabel(from: Date, toInclusive: Date) {
  const startMonth = from.toLocaleDateString("en-GB", { month: "short" });
  const endMonth = toInclusive.toLocaleDateString("en-GB", { month: "short" });
  const range =
    startMonth === endMonth && from.getFullYear() === toInclusive.getFullYear()
      ? `${from.getDate()}–${toInclusive.getDate()} ${endMonth} ${toInclusive.getFullYear()}`
      : `${from.getDate()} ${startMonth} – ${toInclusive.getDate()} ${endMonth} ${toInclusive.getFullYear()}`;
  return `${range} · W${isoWeekNumber(from)}`;
}

export function isoWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/** Mon-first 6-week (42-day) grid covering `monthDate`'s month, including the leading/trailing days of adjacent months needed to fill whole weeks. */
export function monthGrid(monthDate: Date) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = mondayOf(firstOfMonth);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks: Date[][] = [];
  for (let i = 0; i < 42; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/**
 * Cascading stack assignment for same-day overlapping blocks: `col` is how
 * many still-open items were already stacked when this one started (0 for
 * the first/only item in a cluster). Consumers render col 0 full-width, and
 * each higher col offset+shrunk by a fixed step (see OVERLAP_STEP_PCT) so
 * every block in a cluster stays fully visible and clickable, with later
 * (higher-col) blocks stacked on top via z-index.
 */
export function assignColumns<T extends { startMin: number; endMin: number }>(items: T[]): (T & { col: number; cols: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
  const active: { endMin: number }[] = [];
  const placed = sorted.map((item) => {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMin <= item.startMin) active.splice(i, 1);
    }
    const col = active.length;
    active.push({ endMin: item.endMin });
    return { ...item, col };
  });
  const cols = Math.max(1, ...placed.map((p) => p.col + 1));
  return placed.map((item) => ({ ...item, cols }));
}

/** Percent of width each cascade step shifts right / shrinks by — see assignColumns. */
export const OVERLAP_STEP_PCT = 20;

/** left%/width% for a cascaded block at stack depth `col`, clamped so width never collapses to unclickable. */
export function overlapBoxStyle(col: number) {
  const left = col * OVERLAP_STEP_PCT;
  const width = Math.max(OVERLAP_STEP_PCT, 100 - left);
  return { left: `${left}%`, width: `${width}%`, zIndex: col + 1 };
}
