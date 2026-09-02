import { prisma } from "@/lib/prisma";
import { projectWhereForUser, canViewMeetings, type SessionUser } from "@/lib/authz";
import { addDays } from "@/lib/calendar";
import { expandMeetingOccurrences } from "@/lib/meetings";
import type { CalendarMeeting } from "@/components/calendar/WeekCalendar";

export async function getWeekCalendarData(user: SessionUser, weekStart: Date) {
  const weekEnd = addDays(weekStart, 7);

  const events = await prisma.project.findMany({
    where: {
      ...projectWhereForUser(user),
      status: { not: "CANCELLED" },
      OR: [
        // event's effective range (build..strike, falling back to start..end) overlaps the week —
        // shows up in the all-day band
        {
          AND: [
            { OR: [{ buildDate: { lt: weekEnd } }, { buildDate: null, startDate: { lt: weekEnd } }] },
            { OR: [{ strikeDate: { gte: weekStart } }, { strikeDate: null, endDate: { gte: weekStart } }] },
          ],
        },
        // ...or it just has a milestone this week (e.g. an early planning call, weeks before build)
        { roadmapItems: { some: { type: "MILESTONE", date: { gte: weekStart, lt: weekEnd } } } },
      ],
    },
    include: {
      roadmapItems: { where: { type: "MILESTONE", date: { gte: weekStart, lt: weekEnd } } },
      venues: true,
    },
    orderBy: { startDate: "asc" },
  });

  const meetings = canViewMeetings(user) ? await getWeekMeetings(weekStart, weekEnd) : [];

  return { events, meetings };
}

/**
 * Meeting occurrences (recurring or not) landing in [weekStart, weekEnd) —
 * expanded from each matching Meeting's rule via expandMeetingOccurrences()
 * (computed, not materialized; see lib/meetings.ts). Drag-to-reschedule is
 * supported here (see WeekCalendar + actions/meetings.ts), so two candidate
 * sets are unioned: meetings whose base recurrence overlaps the week, and
 * meetings that don't otherwise overlap but have an exception whose newDate
 * was dragged into this week from elsewhere. No per-user scoping beyond
 * canViewMeetings — meetings aren't owned by a single event the way roadmap
 * items are.
 */
async function getWeekMeetings(weekStart: Date, weekEnd: Date): Promise<CalendarMeeting[]> {
  const [recurrenceCandidates, exceptionCandidates] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        OR: [
          { recurrenceFreq: "NONE", date: { gte: weekStart, lt: weekEnd } },
          {
            recurrenceFreq: { not: "NONE" },
            date: { lt: weekEnd },
            OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: weekStart } }],
          },
        ],
      },
      include: { exceptions: true },
    }),
    prisma.meeting.findMany({
      where: { exceptions: { some: { newDate: { gte: weekStart, lt: weekEnd } } } },
      include: { exceptions: true },
    }),
  ]);

  const byId = new Map<string, (typeof recurrenceCandidates)[number]>();
  for (const m of [...recurrenceCandidates, ...exceptionCandidates]) byId.set(m.id, m);

  return [...byId.values()].flatMap((m) =>
    expandMeetingOccurrences(m, weekStart, weekEnd, m.exceptions).map((occ) => ({
      id: m.id,
      title: m.title,
      date: occ.date,
      originalDate: occ.originalDate,
      recurring: m.recurrenceFreq !== "NONE",
    }))
  );
}
