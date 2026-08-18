import { prisma } from "@/lib/prisma";
import { eventWhereForUser, type SessionUser } from "@/lib/authz";
import { startOfDay, addDays, mondayOf, dayHeaderLabel, weekDays } from "@/lib/calendar";

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
  const [running, entries, events] = await Promise.all([
    getRunningTimer(user.id),
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
  return { running, entries, events };
}

/** Everyone selectable in the Overview person filter — a small internal tool, so visibility isn't scoped further. */
export async function getOverviewUsers() {
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type OverviewBucket = { label: string; start: Date; end: Date };

/**
 * day → one "Total" bucket (a day-by-day breakdown of a single day makes no
 * sense; the per-event list carries the detail instead).
 * week → one bucket per calendar day (Mon..Sun).
 * month → one bucket per week, clipped to the month's actual [from, to) so
 * a partial first/last week doesn't pull in days outside the period.
 */
export function overviewBuckets(period: TimePeriod, from: Date, to: Date): OverviewBucket[] {
  if (period === "week") {
    return weekDays(from).map((d) => ({ label: dayHeaderLabel(d), start: d, end: addDays(d, 1) }));
  }
  if (period === "month") {
    const buckets: OverviewBucket[] = [];
    let cursor = mondayOf(from);
    let i = 1;
    while (cursor < to) {
      const end = addDays(cursor, 7);
      buckets.push({ label: `Week ${i}`, start: cursor < from ? from : cursor, end: end > to ? to : end });
      cursor = end;
      i++;
    }
    return buckets;
  }
  return [{ label: "Total", start: from, end: to }];
}

export async function getOverviewData(selectedUsers: { id: string; name: string }[], period: TimePeriod, anchor: Date) {
  const from = rangeStart(period, anchor);
  const to = rangeEnd(period, anchor);
  const buckets = overviewBuckets(period, from, to);

  if (selectedUsers.length === 0) return { from, to, buckets, people: [] };

  const entries = await prisma.timeEntry.findMany({
    where: { userId: { in: selectedUsers.map((u) => u.id) }, running: false, date: { gte: from, lt: to } },
    select: { userId: true, eventId: true, minutes: true, date: true, event: { select: { title: true } } },
  });

  const people = selectedUsers.map((u) => {
    const own = entries.filter((e) => e.userId === u.id);
    const byBucket = buckets.map((b) => own.filter((e) => e.date >= b.start && e.date < b.end).reduce((s, e) => s + e.minutes, 0));
    const total = own.reduce((s, e) => s + e.minutes, 0);

    const byEvent = new Map<string, { title: string; minutes: number }>();
    for (const e of own) {
      const cur = byEvent.get(e.eventId) ?? { title: e.event.title, minutes: 0 };
      cur.minutes += e.minutes;
      byEvent.set(e.eventId, cur);
    }
    const eventBreakdown = [...byEvent.values()].sort((a, b) => b.minutes - a.minutes);

    return { id: u.id, name: u.name, byBucket, total, eventBreakdown };
  });

  return { from, to, buckets, people };
}
