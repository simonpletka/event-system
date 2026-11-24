/**
 * Gear reservation logic, pure so it can be unit-tested and shared by the
 * preview and the commit (which re-plans inside its transaction). Dates are
 * plain "YYYY-MM-DD" Prague days, both ends inclusive; string comparison
 * orders them correctly.
 */
import { daysBetweenKeys, shiftDateKey } from "./prague-date";

export type DayRange = { startDate: string; endDate: string };
export type PlanUnit = { id: string; typeId: string; number: number; active: boolean };
export type PlanBooking = DayRange & { unitId: string };
export type PlanLine = { typeId: string; quantity: number };
export type LinePlan = PlanLine & {
  /** Units this line would take, lowest number first. */
  units: { id: string; number: number }[];
  /** How many more were asked for than are free. 0 when the line is covered. */
  shortBy: number;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in "YYYY-MM-DD" form. */
export function isDateKey(value: string) {
  return DATE_KEY.test(value) && shiftDateKey(value, 0) === value;
}

/** Inclusive whole days: touching ranges (one ends the day the other starts) collide. */
export function rangesOverlap(a: DayRange, b: DayRange) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/** Number of whole days in an inclusive range (a single day is 1). */
export function dayCount(startDate: string, endDate: string) {
  return daysBetweenKeys(startDate, endDate) + 1;
}

/** The day keys of an inclusive range. */
export function daysOf(startDate: string, endDate: string) {
  const n = dayCount(startDate, endDate);
  return Array.from({ length: Math.max(0, n) }, (_, i) => shiftDateKey(startDate, i));
}

/** Active units of one type with no booking overlapping the range, lowest number first. */
export function freeUnits(typeId: string, units: PlanUnit[], bookings: PlanBooking[], range: DayRange) {
  const busy = new Set(bookings.filter((b) => rangesOverlap(b, range)).map((b) => b.unitId));
  return units
    .filter((u) => u.typeId === typeId && u.active && !busy.has(u.id))
    .sort((a, b) => a.number - b.number);
}

/**
 * Which units each line would take for the range, lowest number first, and
 * how short each line falls. Lines for the same type share its free units, so
 * a type listed twice is never given the same unit twice. `prefer` (when
 * editing a reservation: the units it already holds) goes ahead of the
 * lowest numbers, so an edit keeps the same units wherever they're still free.
 */
export function planReservation(
  lines: PlanLine[],
  units: PlanUnit[],
  bookings: PlanBooking[],
  range: DayRange,
  prefer: ReadonlySet<string> = new Set()
): LinePlan[] {
  const taken = new Set<string>();
  return lines.map((line) => {
    const quantity = Math.max(0, Math.floor(line.quantity));
    const free = freeUnits(line.typeId, units, bookings, range)
      .filter((u) => !taken.has(u.id))
      .sort((a, b) => Number(prefer.has(b.id)) - Number(prefer.has(a.id)) || a.number - b.number);
    const picked = free.slice(0, quantity);
    for (const u of picked) taken.add(u.id);
    return { ...line, quantity, units: picked.map((u) => ({ id: u.id, number: u.number })), shortBy: quantity - picked.length };
  });
}

/** Free active units of a type on each day key. */
export function freePerDay(typeId: string, units: PlanUnit[], bookings: PlanBooking[], days: string[]) {
  const ofType = units.filter((u) => u.typeId === typeId && u.active);
  const ids = new Set(ofType.map((u) => u.id));
  const relevant = bookings.filter((b) => ids.has(b.unitId));
  return days.map((day) => {
    const busy = new Set(relevant.filter((b) => b.startDate <= day && day <= b.endDate).map((b) => b.unitId));
    return ofType.length - busy.size;
  });
}

/** Σ (day rate × units) × days, for the units a plan actually takes. */
export function planCost(plan: LinePlan[], dayRates: Map<string, number>, days: number) {
  return plan.reduce((sum, line) => sum + (dayRates.get(line.typeId) ?? 0) * line.units.length, 0) * days;
}
