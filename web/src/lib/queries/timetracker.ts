import { prisma } from "@/lib/prisma";
import { eventWhereForUser, type SessionUser } from "@/lib/authz";
import { startOfDay, addDays, mondayOf } from "@/lib/calendar";
import type { TimePhase } from "@/generated/prisma/enums";

export type TimePeriod = "day" | "week" | "month";

export async function getRunningTimer(userId: string) {
  return prisma.timeEntry.findFirst({
    where: { userId, running: true },
    include: { event: true },
  });
}

export function rangeStart(period: TimePeriod, anchor: Date) {
  const d = startOfDay(anchor);
  if (period === "day") return d;
  if (period === "week") return mondayOf(d);
  d.setDate(1);
  return d;
}

export function rangeEnd(period: TimePeriod, anchor: Date) {
  const start = rangeStart(period, anchor);
  if (period === "day") return addDays(start, 1);
  if (period === "week") return addDays(start, 7);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export async function getMyTimeTrackerData(user: SessionUser, period: TimePeriod, anchor: Date) {
  const from = rangeStart(period, anchor);
  const to = rangeEnd(period, anchor);

  const [running, entries, events] = await Promise.all([
    getRunningTimer(user.id),
    prisma.timeEntry.findMany({
      where: { userId: user.id, running: false, date: { gte: from, lt: to } },
      include: { event: true },
      orderBy: { date: "desc" },
    }),
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const byEvent = new Map<string, { title: string; minutes: number }>();
  for (const t of entries) {
    const cur = byEvent.get(t.event.id) ?? { title: t.event.title, minutes: 0 };
    cur.minutes += t.minutes;
    byEvent.set(t.event.id, cur);
  }
  const periodTotals = [...byEvent.values()].sort((a, b) => b.minutes - a.minutes);
  const periodTotalMinutes = periodTotals.reduce((s, e) => s + e.minutes, 0);

  return { running, entries, periodTotals, periodTotalMinutes, events };
}

export async function getTimeTrackerCalendarData(user: SessionUser, weekStart: Date) {
  const weekEnd = addDays(weekStart, 7);
  const [entries, events] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId: user.id, running: false, date: { gte: weekStart, lt: weekEnd } },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
  ]);
  return { entries, events };
}

export async function getCompareEventsData(user: SessionUser, eventIds: string[]) {
  if (eventIds.length === 0) return null;

  const events = await prisma.event.findMany({
    where: { id: { in: eventIds }, ...eventWhereForUser(user) },
    select: {
      id: true,
      title: true,
      quotedValue: true,
      members: { select: { userId: true } },
      timeEntries: {
        where: { running: false },
        select: { userId: true, minutes: true, phase: true, user: { select: { name: true } } },
      },
    },
  });

  const perEvent = events.map((e) => {
    const totalMinutes = e.timeEntries.reduce((s, t) => s + t.minutes, 0);
    const people = new Set(e.timeEntries.map((t) => t.userId));
    const costPerHour = totalMinutes > 0 ? Math.round((e.quotedValue / totalMinutes) * 60) : 0;
    const phaseMinutes: Record<TimePhase, number> = { PLANNING: 0, SUPPLIERS: 0, ON_SITE: 0, WRAP_UP: 0 };
    for (const t of e.timeEntries) phaseMinutes[t.phase] += t.minutes;
    return { id: e.id, title: e.title, quotedValue: e.quotedValue, totalMinutes, peopleCount: people.size, costPerHour, phaseMinutes };
  });

  const personNames = new Map<string, string>();
  const perPerson = new Map<string, Record<string, number>>();
  for (const e of events) {
    for (const t of e.timeEntries) {
      personNames.set(t.userId, t.user.name);
      const row = perPerson.get(t.userId) ?? {};
      row[e.id] = (row[e.id] ?? 0) + t.minutes;
      perPerson.set(t.userId, row);
    }
  }
  const personRows = [...perPerson.entries()]
    .map(([userId, minutesByEvent]) => ({ userId, name: personNames.get(userId)!, minutesByEvent }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { events: perEvent, personRows };
}
