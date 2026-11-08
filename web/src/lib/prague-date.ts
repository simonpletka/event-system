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
