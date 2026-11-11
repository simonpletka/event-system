/**
 * Calendar dates as people in Prague see them, independent of the server's
 * timezone (Railway runs in UTC) and of the viewer's browser. Client-safe:
 * the dashboard formats on both server and client, and a timezone-dependent
 * format would make the two disagree and break hydration.
 */
export const PRAGUE = "Europe/Prague";

/** "YYYY-MM-DD" of the instant's calendar day in Prague. */
export function pragueDateKey(date: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: PRAGUE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    typeof date === "string" ? new Date(date) : date
  );
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "YYYY-MM" of a day key or instant. */
export function monthKeyOf(dateKey: string) {
  return dateKey.slice(0, 7);
}

/** The month before/after "YYYY-MM". */
export function shiftMonth(monthKey: string, by: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The cells of a Monday-first month grid: leading blanks as null, then every
 * day key of the month. Done in UTC on the plain date, so no timezone or DST
 * can shift a day.
 */
export function monthGridKeys(monthKey: string): (string | null)[] {
  const [y, m] = monthKey.split("-").map(Number);
  const leading = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${monthKey}-${String(d).padStart(2, "0")}`);
  return cells;
}

export function formatPragueDate(date: Date | string, locale: "en" | "cs", opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { timeZone: PRAGUE, ...opts }).format(
    typeof date === "string" ? new Date(date) : date
  );
}

/** "4 Nov" or "4 – 6 Nov" style range in Prague time. */
export function formatPragueRange(start: Date | string, end: Date | string, locale: "en" | "cs") {
  const day: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const a = formatPragueDate(start, locale, day);
  const b = formatPragueDate(end, locale, day);
  return a === b ? a : `${a} – ${b}`;
}

/** Month heading for a "YYYY-MM" key, e.g. "November 2026". */
export function formatMonthKey(monthKey: string, locale: "en" | "cs") {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 15))
  );
}

/** The UTC instant of a wall-clock time in Prague, DST included. */
export function pragueInstant(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, 0, minutes);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  /** How far Prague's clock is ahead of UTC at an instant, in ms. */
  const offset = (instant: number) => {
    const parts = format.formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - instant;
  };
  // The offset is checked again at the first guess, so a time just before a
  // clock change isn't read with the offset from just after it.
  const guess = asUtc - offset(asUtc);
  return new Date(asUtc - offset(guess));
}

/** The calendar day `by` days after a "YYYY-MM-DD" key. Plain date arithmetic, so DST can't shift it. */
export function shiftDateKey(dateKey: string, by: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
}

/** Whole days from one "YYYY-MM-DD" key to another. */
export function daysBetweenKeys(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The Monday of the week containing a "YYYY-MM-DD" key. */
export function mondayKey(dateKey: string) {
  const weekday = (new Date(`${dateKey}T00:00:00Z`).getUTCDay() + 6) % 7;
  return shiftDateKey(dateKey, -weekday);
}

/** Minutes after midnight of the instant's wall-clock time in Prague. */
export function pragueMinutes(date: Date | string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: PRAGUE, hourCycle: "h23", hour: "numeric", minute: "numeric" }).formatToParts(
    typeof date === "string" ? new Date(date) : date
  );
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return get("hour") * 60 + get("minute");
}

/**
 * A form's "YYYY-MM-DDTHH:mm" value, read as Prague wall-clock time. Plain
 * `new Date()` would read it in the server's timezone, so on a UTC host 10:00
 * would be saved as 11:00. A plain "YYYY-MM-DD" is returned as `new Date()`
 * reads it (UTC midnight), which every all-day value already relies on.
 */
export function parsePragueDateTime(raw: string) {
  const timed = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(raw);
  return timed ? pragueInstant(timed[1], Number(timed[2]) * 60 + Number(timed[3])) : new Date(raw);
}

/** The value for a date or date-and-time field, in Prague time, so the server and the browser render the same thing. */
export function toPragueInput(date: Date | string, withTime = true) {
  const day = pragueDateKey(date);
  if (!withTime) return day;
  const minutes = pragueMinutes(date);
  return `${day}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
