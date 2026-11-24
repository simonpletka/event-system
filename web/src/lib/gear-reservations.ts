/**
 * Gear reservation logic, pure so it can be unit-tested and shared by every
 * count and plan: the reserve preview, the commit (which re-plans inside its
 * transaction), the catalog's "Free today", the availability grid and
 * reassigning. Dates are plain "YYYY-MM-DD" Prague days, both ends
 * inclusive; string comparison orders them correctly.
 *
 * Two rules live here and nowhere else, so counts can't drift apart:
 *  - whether a unit can be used on a day (its condition, and for IN_SERVICE
 *    its `backAt`), see unitUsableOn;
 *  - what a booking blocks: its days, and while a unit is picked up but not
 *    returned, every day up to today too, so a late return can't be
 *    double-booked. See blockedRange.
 */
import { daysBetweenKeys, shiftDateKey } from "./prague-date";

export type GearConditionValue = "OK" | "NEEDS_ATTENTION" | "DAMAGED" | "IN_SERVICE" | "RETIRED" | "LOST";
export type DayRange = { startDate: string; endDate: string };
export type PlanUnit = { id: string; typeId: string; number: number; condition: GearConditionValue; backAt?: string | null };
export type PlanBooking = DayRange & { unitId: string; pickedUpAt?: Date | string | null; returnedAt?: Date | string | null };
export type PlanLine = { typeId: string; quantity: number };
export type LinePlan = PlanLine & {
  /** Units this line would take, lowest number first. */
  units: { id: string; number: number }[];
  /** How many more were asked for than are free. 0 when the line is covered. */
  shortBy: number;
};
export type PlanOptions = {
  /** Units to take first when free (editing keeps the units a reservation already holds). */
  prefer?: ReadonlySet<string>;
  /** Today's Prague date: an unreturned pick-up blocks up to it. */
  today?: string;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Conditions that can be booked. NEEDS_ATTENTION can, with a warning. */
export const BOOKABLE_CONDITIONS: ReadonlySet<GearConditionValue> = new Set(["OK", "NEEDS_ATTENTION"]);

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

/** Can the unit be used on this day? IN_SERVICE with a `backAt` is out until that day, inclusive. */
export function unitUsableOn(unit: Pick<PlanUnit, "condition" | "backAt">, day: string) {
  if (BOOKABLE_CONDITIONS.has(unit.condition)) return true;
  if (unit.condition === "IN_SERVICE" && unit.backAt) return day > unit.backAt;
  return false;
}

/** Usable on every day of the range. Conditions only ever free up later, so the first day decides. */
export function unitUsableFor(unit: Pick<PlanUnit, "condition" | "backAt">, range: DayRange) {
  return unitUsableOn(unit, range.startDate);
}

/** The days a booking keeps its unit: an unreturned pick-up runs on to today. */
export function blockedRange(booking: PlanBooking, today?: string): DayRange {
  const out = Boolean(booking.pickedUpAt) && !booking.returnedAt;
  if (out && today && today > booking.endDate) return { startDate: booking.startDate, endDate: today };
  return { startDate: booking.startDate, endDate: booking.endDate };
}

/** Is this unit unreturned past its end date? */
export function isOverdue(booking: PlanBooking, today: string) {
  return Boolean(booking.pickedUpAt) && !booking.returnedAt && booking.endDate < today;
}

export function bookingBlocks(booking: PlanBooking, range: DayRange, today?: string) {
  return rangesOverlap(blockedRange(booking, today), range);
}

/** Usable units of one type with no booking blocking the range, lowest number first. */
export function freeUnits(typeId: string, units: PlanUnit[], bookings: PlanBooking[], range: DayRange, today?: string) {
  const busy = new Set(bookings.filter((b) => bookingBlocks(b, range, today)).map((b) => b.unitId));
  return units
    .filter((u) => u.typeId === typeId && unitUsableFor(u, range) && !busy.has(u.id))
    .sort((a, b) => a.number - b.number);
}

/**
 * Which units each line would take for the range, lowest number first, and
 * how short each line falls. Lines for the same type share its free units, so
 * a type listed twice is never given the same unit twice. `prefer` goes ahead
 * of the lowest numbers, so an edit keeps the same units wherever it can.
 */
export function planReservation(lines: PlanLine[], units: PlanUnit[], bookings: PlanBooking[], range: DayRange, opts: PlanOptions = {}): LinePlan[] {
  const prefer = opts.prefer ?? new Set<string>();
  const taken = new Set<string>();
  return lines.map((line) => {
    const quantity = Math.max(0, Math.floor(line.quantity));
    const free = freeUnits(line.typeId, units, bookings, range, opts.today)
      .filter((u) => !taken.has(u.id))
      .sort((a, b) => Number(prefer.has(b.id)) - Number(prefer.has(a.id)) || a.number - b.number);
    const picked = free.slice(0, quantity);
    for (const u of picked) taken.add(u.id);
    return { ...line, quantity, units: picked.map((u) => ({ id: u.id, number: u.number })), shortBy: quantity - picked.length };
  });
}

/** Usable units of a type on each day key: the "total" every count is out of. */
export function usablePerDay(typeId: string, units: PlanUnit[], days: string[]) {
  const ofType = units.filter((u) => u.typeId === typeId);
  return days.map((day) => ofType.filter((u) => unitUsableOn(u, day)).length);
}

/** Free (usable and not blocked) units of a type on each day key. */
export function freePerDay(typeId: string, units: PlanUnit[], bookings: PlanBooking[], days: string[], today?: string) {
  const ofType = units.filter((u) => u.typeId === typeId);
  const ids = new Set(ofType.map((u) => u.id));
  const relevant = bookings.filter((b) => ids.has(b.unitId)).map((b) => ({ unitId: b.unitId, ...blockedRange(b, today) }));
  return days.map((day) => {
    const busy = new Set(relevant.filter((b) => b.startDate <= day && day <= b.endDate).map((b) => b.unitId));
    return ofType.filter((u) => unitUsableOn(u, day) && !busy.has(u.id)).length;
  });
}

/** Σ (day rate × units) × days, for the units a plan actually takes. */
export function planCost(plan: LinePlan[], dayRates: Map<string, number>, days: number) {
  return plan.reduce((sum, line) => sum + (dayRates.get(line.typeId) ?? 0) * line.units.length, 0) * days;
}

/**
 * Where a booking can move when its unit can't serve it: the lowest free
 * unit of the same type for the same days, never the unit it's on. Null when
 * none is free. `bookings` must leave out the booking being moved.
 */
export function reassignTarget(
  booking: DayRange & { unitId: string },
  typeId: string,
  units: PlanUnit[],
  bookings: PlanBooking[],
  today?: string
) {
  const others = units.filter((u) => u.id !== booking.unitId);
  return freeUnits(typeId, others, bookings, booking, today)[0] ?? null;
}
