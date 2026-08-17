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

const DAY_LABEL = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function dayHeaderLabel(d: Date) {
  return `${DAY_LABEL[(d.getDay() + 6) % 7]} ${d.getDate()}`;
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

export function isoWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/** Greedy interval-graph column assignment for same-day overlapping blocks. */
export function assignColumns<T extends { startMin: number; endMin: number }>(items: T[]): (T & { col: number; cols: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
  const columnEnds: number[] = [];
  const placed = sorted.map((item) => {
    let col = columnEnds.findIndex((end) => end <= item.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(item.endMin);
    } else {
      columnEnds[col] = item.endMin;
    }
    return { ...item, col };
  });
  const cols = Math.max(1, columnEnds.length);
  return placed.map((item) => ({ ...item, cols }));
}
