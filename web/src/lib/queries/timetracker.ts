import { prisma } from "@/lib/prisma";
import { eventWhereForUser, type SessionUser } from "@/lib/authz";
import type { TimePhase } from "@/generated/prisma/enums";

export async function getRunningTimer(userId: string) {
  return prisma.timeEntry.findFirst({
    where: { userId, running: true },
    include: { event: true },
  });
}

function rangeStart(period: "day" | "week" | "month", now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "day") return d;
  if (period === "week") {
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    return d;
  }
  d.setDate(1);
  return d;
}

export async function getMyTimeTrackerData(user: SessionUser, period: "day" | "week" | "month") {
  const now = new Date();
  const from = rangeStart(period, now);
  const weekStart = rangeStart("week", now);

  const [running, entries, thisWeek, events] = await Promise.all([
    getRunningTimer(user.id),
    prisma.timeEntry.findMany({
      where: { userId: user.id, running: false, date: { gte: from } },
      include: { event: true },
      orderBy: { date: "desc" },
    }),
    prisma.timeEntry.findMany({
      where: { userId: user.id, running: false, date: { gte: weekStart } },
      include: { event: { select: { id: true, title: true } } },
    }),
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const byEvent = new Map<string, { title: string; minutes: number }>();
  for (const t of thisWeek) {
    const cur = byEvent.get(t.event.id) ?? { title: t.event.title, minutes: 0 };
    cur.minutes += t.minutes;
    byEvent.set(t.event.id, cur);
  }
  const weekTotals = [...byEvent.values()].sort((a, b) => b.minutes - a.minutes);
  const weekTotalMinutes = weekTotals.reduce((s, e) => s + e.minutes, 0);

  return { running, entries, weekTotals, weekTotalMinutes, events };
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
