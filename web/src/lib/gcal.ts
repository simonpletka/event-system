/**
 * Google Calendar / Meet sync for roadmap items — DEFERRED.
 *
 * The real implementation (a domain-wide-delegation service account
 * impersonating a shared agency calendar, `events.insert` with
 * `conferenceData` for the Meet link, then writing `googleCalendarEventId` /
 * `googleMeetUrl` back onto the RoadmapItem) is spec'd in TODO.md at the repo
 * root. Until then this module is inert: `createCalendarEvent` always throws
 * `CalendarNotConfiguredError`, and `tryCreateCalendarEvent` swallows it —
 * mirrors the `DriveNotConfiguredError` / `tryUploadFinanceDocument` pattern
 * in gdrive.ts, so a roadmap-item save never fails because Calendar isn't
 * wired.
 */

export class CalendarNotConfiguredError extends Error {
  constructor() {
    super("Google Calendar / Meet sync isn't wired up yet — see TODO.md at the repo root.");
    this.name = "CalendarNotConfiguredError";
  }
}

export type CalendarEventInput = {
  summary: string;
  description?: string;
  start: Date;
  allDay: boolean;
  attendees: { email: string }[];
  withMeet: boolean;
};

export type CalendarSyncResult = { calendarEventId: string; meetUrl: string | null };

/** Deferred — always throws until Calendar sync is built (see TODO.md). */
export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarSyncResult> {
  void input;
  throw new CalendarNotConfiguredError();
}

/**
 * Best-effort wrapper: never throws. Callers in actions/roadmap.ts inspect
 * `ok` and log rather than surface an error to the user.
 */
export async function tryCreateCalendarEvent(
  input: CalendarEventInput
): Promise<({ ok: true } & CalendarSyncResult) | { ok: false; error: string }> {
  try {
    return { ok: true, ...(await createCalendarEvent(input)) };
  } catch (e) {
    if (e instanceof CalendarNotConfiguredError) return { ok: false, error: e.message };
    console.error("Google Calendar sync failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unknown Google Calendar error." };
  }
}

/** Whether Calendar sync is live. Always false today — the UI uses this to disable the Meet button and calendar hints. */
export function isCalendarConfigured() {
  return false;
}
