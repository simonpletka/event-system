import { prisma } from "@/lib/prisma";
import { projectWhereForUser, canViewMeetings, canManageMeetings, canEditProject, canViewProjectBudget, type SessionUser } from "@/lib/authz";
import { pragueInstant, shiftDateKey } from "@/lib/prague-date";
import { expandMeetingOccurrences } from "@/lib/meetings";
import type { CalendarMeeting, CalendarProject } from "@/components/calendar/WeekCalendar";

/** `weekKey` is the week's Monday as "YYYY-MM-DD"; the week runs Monday to Sunday in Prague whatever the server's timezone. */
export async function getWeekCalendarData(user: SessionUser, weekKey: string): Promise<{ events: CalendarProject[]; meetings: CalendarMeeting[] }> {
  const weekStart = pragueInstant(weekKey, 0);
  const weekEnd = pragueInstant(shiftDateKey(weekKey, 7), 0);

  const projects = await prisma.project.findMany({
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
      members: { select: { userId: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const showValue = canViewProjectBudget(user);
  const events = projects.map((p) => ({
    id: p.id,
    number: p.number,
    title: p.title,
    client: p.companyName,
    status: p.status,
    value: showValue && p.quotedValue ? p.quotedValue : null,
    place: p.venues[0]?.name ?? null,
    address: p.venues[0]?.address ?? null,
    editable: canEditProject(user, { ownerId: p.ownerId, memberIds: p.members.map((m) => m.userId) }),
    buildDate: p.buildDate?.toISOString() ?? null,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    strikeDate: p.strikeDate?.toISOString() ?? null,
    milestones: p.roadmapItems.map((m) => ({ id: m.id, title: m.title, date: m.date.toISOString(), allDay: m.allDay })),
  }));

  const meetings = canViewMeetings(user) ? await getWeekMeetings(weekStart, weekEnd, canManageMeetings(user)) : [];

  return { events, meetings };
}

const meetingInclude = {
  exceptions: true,
  projects: { include: { project: { select: { number: true, title: true } } } },
} as const;

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
async function getWeekMeetings(weekStart: Date, weekEnd: Date, editable: boolean): Promise<CalendarMeeting[]> {
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
      include: meetingInclude,
    }),
    prisma.meeting.findMany({
      where: { exceptions: { some: { newDate: { gte: weekStart, lt: weekEnd } } } },
      include: meetingInclude,
    }),
  ]);

  const byId = new Map<string, (typeof recurrenceCandidates)[number]>();
  for (const m of [...recurrenceCandidates, ...exceptionCandidates]) byId.set(m.id, m);

  return [...byId.values()].flatMap((m) =>
    expandMeetingOccurrences(m, weekStart, weekEnd, m.exceptions).map((occ) => ({
      id: m.id,
      title: m.title,
      date: occ.date.toISOString(),
      originalDate: occ.originalDate.toISOString(),
      recurring: m.recurrenceFreq !== "NONE",
      allDay: m.allDay,
      editable,
      projects: m.projects.map((mp) => mp.project),
    }))
  );
}
