import { prisma } from "@/lib/prisma";
import { eventWhereForUser, type SessionUser } from "@/lib/authz";
import { startOfDay, addDays, mondayOf, dayHeaderLabel, weekDays, monthsOfYear, monthHeaderLabel } from "@/lib/calendar";

export type TimePeriod = "day" | "week" | "month" | "year";

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
  if (period === "year") {
    d.setMonth(0, 1);
    return d;
  }
  d.setDate(1);
  return d;
}

export function rangeEnd(period: TimePeriod, anchor: Date) {
  const start = rangeStart(period, anchor);
  if (period === "day") return addDays(start, 1);
  if (period === "week") return addDays(start, 7);
  const end = new Date(start);
  if (period === "year") {
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }
  end.setMonth(end.getMonth() + 1);
  return end;
}

/** `to` is exclusive — callers picking an inclusive end date should pass `addDays(toInclusive, 1)`. */
export async function getMyTimeTrackerData(user: SessionUser, from: Date, to: Date) {
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

  return { running, entries, events };
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

/** Everyone selectable in the Overview event filter, scoped the same way as the rest of time tracking. */
export async function getOverviewEvents(user: SessionUser) {
  return prisma.event.findMany({
    where: eventWhereForUser(user),
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}

/** Every client with at least one event visible to this user — the Overview client filter. */
export async function getOverviewClients(user: SessionUser) {
  return prisma.client.findMany({
    where: { events: { some: eventWhereForUser(user) } },
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
 * year → one bucket per calendar month (Jan..Dec).
 */
export function overviewBuckets(period: TimePeriod, from: Date, to: Date): OverviewBucket[] {
  if (period === "week") {
    return weekDays(from).map((d) => ({ label: dayHeaderLabel(d), start: d, end: addDays(d, 1) }));
  }
  if (period === "year") {
    return monthsOfYear(from).map((start) => ({
      label: monthHeaderLabel(start),
      start,
      end: new Date(start.getFullYear(), start.getMonth() + 1, 1),
    }));
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

export type OverviewAxis = "person" | "event" | "phase";
/**
 * `name` is the raw label for a person/event row — `null` for an unassigned
 * event or any phase row, since a phase's display name is a translated enum
 * label the page derives from `id` (a TimePhase key), not data from here.
 */
export type OverviewRow = { id: string; name: string | null; byBucket: number[]; total: number };

const UNASSIGNED_EVENT_KEY = "__unassigned__";

/**
 * `eventIds` restricts which events' time counts (independent of `axis` —
 * you can break down by Phase while still only looking at one event's time).
 * `"unassigned"` in the list additionally includes eventless entries; pass
 * `null`/undefined for no event filtering at all.
 * `clientIds` further restricts to events belonging to one of those clients
 * (ANDed with `eventIds`, not ORed — an eventless entry never has a client).
 * `descriptionQuery` is a case-insensitive substring match against the entry
 * description, applied in JS since SQLite's Prisma provider has no
 * case-insensitive `contains` mode.
 */
export async function getOverviewData(
  selectedUsers: { id: string; name: string }[],
  period: TimePeriod,
  anchor: Date,
  axis: OverviewAxis = "person",
  eventIds?: string[] | null,
  clientIds?: string[] | null,
  descriptionQuery?: string | null
) {
  const from = rangeStart(period, anchor);
  const to = rangeEnd(period, anchor);
  const buckets = overviewBuckets(period, from, to);

  if (selectedUsers.length === 0) return { from, to, buckets, rows: [] as OverviewRow[] };

  const wantsUnassigned = eventIds?.includes("unassigned") ?? false;
  const specificEventIds = eventIds?.filter((id) => id !== "unassigned") ?? [];

  let entries = await prisma.timeEntry.findMany({
    where: {
      userId: { in: selectedUsers.map((u) => u.id) },
      running: false,
      date: { gte: from, lt: to },
      ...(eventIds && eventIds.length > 0
        ? {
            OR: [
              ...(specificEventIds.length > 0 ? [{ eventId: { in: specificEventIds } }] : []),
              ...(wantsUnassigned ? [{ eventId: null }] : []),
            ],
          }
        : {}),
      ...(clientIds && clientIds.length > 0 ? { event: { clientId: { in: clientIds } } } : {}),
    },
    select: {
      userId: true,
      eventId: true,
      phase: true,
      minutes: true,
      date: true,
      description: true,
      event: { select: { title: true } },
    },
  });

  if (descriptionQuery?.trim()) {
    const q = descriptionQuery.trim().toLowerCase();
    entries = entries.filter((e) => e.description.toLowerCase().includes(q));
  }

  function bucketize(rowEntries: typeof entries) {
    const byBucket = buckets.map((b) => rowEntries.filter((e) => e.date >= b.start && e.date < b.end).reduce((s, e) => s + e.minutes, 0));
    const total = rowEntries.reduce((s, e) => s + e.minutes, 0);
    return { byBucket, total };
  }

  let rows: OverviewRow[];
  if (axis === "person") {
    rows = selectedUsers.map((u) => ({ id: u.id, name: u.name, ...bucketize(entries.filter((e) => e.userId === u.id)) }));
  } else if (axis === "event") {
    const byEvent = new Map<string, { name: string | null; entries: typeof entries }>();
    for (const e of entries) {
      const key = e.eventId ?? UNASSIGNED_EVENT_KEY;
      const group = byEvent.get(key) ?? { name: e.event?.title ?? null, entries: [] };
      group.entries.push(e);
      byEvent.set(key, group);
    }
    rows = [...byEvent.entries()]
      .map(([id, group]) => ({ id, name: group.name, ...bucketize(group.entries) }))
      .sort((a, b) => b.total - a.total);
  } else {
    const byPhase = new Map<string, typeof entries>();
    for (const e of entries) byPhase.set(e.phase, [...(byPhase.get(e.phase) ?? []), e]);
    rows = [...byPhase.entries()]
      .map(([id, list]) => ({ id, name: null, ...bucketize(list) }))
      .sort((a, b) => b.total - a.total);
  }

  return { from, to, buckets, rows };
}
