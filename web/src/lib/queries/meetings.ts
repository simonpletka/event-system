import { prisma } from "@/lib/prisma";
import { canViewMeetings, projectWhereForUser, type SessionUser } from "@/lib/authz";
import { nextOccurrenceFrom } from "@/lib/meetings";
import type { MeetingType } from "@/generated/prisma/enums";

export async function getMeetingList(user: SessionUser, type?: MeetingType) {
  if (!canViewMeetings(user)) return [];
  const meetings = await prisma.meeting.findMany({
    where: type ? { type } : undefined,
    include: { projects: { include: { project: { select: { id: true, title: true } } } }, exceptions: true },
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
    projects: m.projects.map((mp) => mp.project),
  }));
}

export async function getMeetingDetail(user: SessionUser, id: string) {
  if (!canViewMeetings(user)) return null;
  return prisma.meeting.findUnique({ where: { id }, include: { projects: true } });
}

/** Meetings linked to one project, newest first — for the project detail's Roadmap tab. */
export async function getMeetingsForProject(user: SessionUser, projectId: string) {
  if (!canViewMeetings(user)) return [];
  return prisma.meeting.findMany({
    where: { projects: { some: { projectId } } },
    orderBy: { date: "desc" },
  });
}

/** Project options for the meeting form's picker, scoped the same way as the rest of the app. */
export async function getProjectOptionsForUser(user: SessionUser) {
  return prisma.project.findMany({
    where: projectWhereForUser(user),
    select: { id: true, title: true },
    orderBy: { startDate: "desc" },
  });
}
