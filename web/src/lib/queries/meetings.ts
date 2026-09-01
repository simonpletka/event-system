import { prisma } from "@/lib/prisma";
import { canViewMeetings, eventWhereForUser, type SessionUser } from "@/lib/authz";
import { nextOccurrenceFrom } from "@/lib/meetings";
import type { MeetingType } from "@/generated/prisma/enums";

export async function getMeetingList(user: SessionUser, type?: MeetingType) {
  if (!canViewMeetings(user)) return [];
  const meetings = await prisma.meeting.findMany({
    where: type ? { type } : undefined,
    include: { events: { include: { event: { select: { id: true, title: true } } } }, exceptions: true },
    orderBy: { date: "desc" },
  });
  const now = new Date();
  return meetings.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type,
    date: m.date,
    allDay: m.allDay,
    attendees: m.attendees,
    recurring: m.recurrenceFreq !== "NONE",
    nextOccurrence: nextOccurrenceFrom(m, now, m.exceptions),
    events: m.events.map((me) => me.event),
  }));
}

export async function getMeetingDetail(user: SessionUser, id: string) {
  if (!canViewMeetings(user)) return null;
  return prisma.meeting.findUnique({ where: { id }, include: { events: true } });
}

/** Meetings linked to one event, newest first — for the event detail's Roadmap tab. */
export async function getMeetingsForEvent(user: SessionUser, eventId: string) {
  if (!canViewMeetings(user)) return [];
  return prisma.meeting.findMany({
    where: { events: { some: { eventId } } },
    orderBy: { date: "desc" },
  });
}

/** Event options for the meeting form's picker, scoped the same way as the rest of the app. */
export async function getEventOptionsForUser(user: SessionUser) {
  return prisma.event.findMany({
    where: eventWhereForUser(user),
    select: { id: true, title: true },
    orderBy: { startDate: "desc" },
  });
}
