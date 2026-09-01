import { addDays } from "@/lib/calendar";
import type { RecurrenceFreq } from "@/generated/prisma/enums";

/** Local-calendar-month step, clamping to the target month's last day (Jan 31 + 1mo -> Feb 28/29, not Mar 3). */
function addMonths(d: Date, months: number) {
  const day = d.getDate();
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  if (copy.getDate() !== day) copy.setDate(0);
  return copy;
}

function stepDate(d: Date, freq: RecurrenceFreq, interval: number): Date {
  if (freq === "DAILY") return addDays(d, interval);
  if (freq === "WEEKLY") return addDays(d, interval * 7);
  if (freq === "MONTHLY") return addMonths(d, interval);
  return d;
}

export type RecurrenceRule = {
  date: Date;
  recurrenceFreq: RecurrenceFreq;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
};

export type MeetingExceptionRule = { originalDate: Date; newDate: Date };

/** One displayed occurrence — `date` is what's shown (after any exception is applied), `originalDate` is the un-overridden date the base rule produced, which is the key used to record/look up a MeetingException. For a non-recurring meeting the two are always equal. */
export type MeetingOccurrence = { date: Date; originalDate: Date };

/** The base recurrence rule's occurrence dates within `[rangeStart, rangeEnd)`, ignoring exceptions entirely — see expandMeetingOccurrences for the exception-aware version actually used for display. Bounded to 10,000 steps as a defensive cap against a runaway interval/until combination; that covers decades of daily recurrence, far beyond anything a real meeting needs. */
function computeBaseOccurrences(meeting: RecurrenceRule, rangeStart: Date, rangeEnd: Date): Date[] {
  const { date, recurrenceFreq, recurrenceInterval, recurrenceUntil } = meeting;
  if (recurrenceFreq === "NONE") {
    return date >= rangeStart && date < rangeEnd ? [date] : [];
  }
  const interval = Math.max(1, recurrenceInterval);
  const occurrences: Date[] = [];
  let cursor = date;
  for (let i = 0; i < 10000 && cursor < rangeEnd; i++) {
    if (recurrenceUntil && cursor > recurrenceUntil) break;
    if (cursor >= rangeStart) occurrences.push(cursor);
    cursor = stepDate(cursor, recurrenceFreq, interval);
  }
  return occurrences;
}

/**
 * Expands a Meeting's recurrence rule into every displayed occurrence within
 * `[rangeStart, rangeEnd)`, honoring per-occurrence MeetingException rows
 * (drag-to-reschedule "this occurrence only" — see
 * rescheduleMeetingOccurrenceAction). An occurrence whose original slot has
 * an exception is shown at its `newDate` instead (and only if that falls
 * within range); an exception whose `newDate` was moved INTO this range from
 * a different original slot is also included, so a meeting dragged a few
 * weeks over still shows up when viewing its new week.
 */
export function expandMeetingOccurrences(
  meeting: RecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: MeetingExceptionRule[] = []
): MeetingOccurrence[] {
  const exceptionMap = new Map(exceptions.map((e) => [e.originalDate.getTime(), e.newDate]));
  const seen = new Set<number>();
  const results: MeetingOccurrence[] = [];

  for (const originalDate of computeBaseOccurrences(meeting, rangeStart, rangeEnd)) {
    seen.add(originalDate.getTime());
    const newDate = exceptionMap.get(originalDate.getTime());
    if (newDate) {
      if (newDate >= rangeStart && newDate < rangeEnd) results.push({ date: newDate, originalDate });
      continue; // cancelled-from-view (moved outside range), or shown below via the loop over exceptions
    }
    results.push({ date: originalDate, originalDate });
  }

  for (const e of exceptions) {
    if (seen.has(e.originalDate.getTime())) continue; // already handled above
    if (e.newDate >= rangeStart && e.newDate < rangeEnd) results.push({ date: e.newDate, originalDate: e.originalDate });
  }

  return results;
}

/** Next occurrence at or after `from` (or null if the series has already ended) — used for "upcoming" sorting on the Meetings list. */
export function nextOccurrenceFrom(meeting: RecurrenceRule, from: Date, exceptions: MeetingExceptionRule[] = []): Date | null {
  if (meeting.recurrenceFreq === "NONE") {
    // non-recurring meetings never have exceptions, so meeting.date is authoritative
    return meeting.date >= from ? meeting.date : null;
  }
  const farFuture = addMonths(from, 240); // 20-year search horizon is more than enough for any real series
  const found = expandMeetingOccurrences(meeting, from, farFuture, exceptions);
  if (found.length === 0) return null;
  return found.map((o) => o.date).sort((a, b) => a.getTime() - b.getTime())[0];
}
