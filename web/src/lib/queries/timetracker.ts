import { prisma } from "@/lib/prisma";
import { projectWhereForUser, type SessionUser } from "@/lib/authz";
import { startOfDay, addDays, mondayOf, dayHeaderLabel, weekDays, monthsOfYear, monthHeaderLabel } from "@/lib/calendar";

export type TimePeriod = "day" | "week" | "month" | "year";

export async function getRunningTimer(userId: string) {
  return prisma.timeEntry.findFirst({
    where: { userId, running: true },
    include: { project: true },
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
  const [running, entries, projects] = await Promise.all([
    getRunningTimer(user.id),
    prisma.timeEntry.findMany({
      where: { userId: user.id, running: false, date: { gte: from, lt: to } },
      include: { project: true },
      orderBy: { date: "desc" },
    }),
    prisma.project.findMany({
      where: projectWhereForUser(user),
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return { running, entries, projects };
}

export async function getTimeTrackerCalendarData(user: SessionUser, weekStart: Date) {
  const weekEnd = addDays(weekStart, 7);
  const [running, entries, projects] = await Promise.all([
    getRunningTimer(user.id),
    prisma.timeEntry.findMany({
      where: { userId: user.id, running: false, date: { gte: weekStart, lt: weekEnd } },
      include: { project: { select: { id: true, title: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.project.findMany({
      where: projectWhereForUser(user),
      select: { id: true, title: true, companyName: true },
      orderBy: { title: "asc" },
    }),
  ]);
  return { running, entries, projects };
}

/** Everyone selectable in the Overview person filter — a small internal tool, so visibility isn't scoped further. */
export async function getOverviewUsers() {
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Everyone selectable in the Overview project filter, scoped the same way as the rest of time tracking. */
export async function getOverviewProjects(user: SessionUser) {
  return prisma.project.findMany({
    where: projectWhereForUser(user),
    select: { id: true, number: true, title: true },
    orderBy: { title: "asc" },
  });
}

/** Every client with at least one project visible to this user — the Overview client filter. */
export async function getOverviewClients(user: SessionUser) {
  return prisma.client.findMany({
    where: { projects: { some: projectWhereForUser(user) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type OverviewBucket = { label: string; start: Date; end: Date };

/**
 * day → one "Total" bucket (a day-by-day breakdown of a single day makes no
 * sense; the per-project list carries the detail instead).
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

export type OverviewAxis = "person" | "project" | "phase";
/**
 * `name` is the raw label for a person/project row — `null` for an unassigned
 * project or any phase row, since a phase's display name is a translated enum
 * label the page derives from `id` (a TimePhase key), not data from here.
 */
export type OverviewRow = { id: string; name: string | null; byBucket: number[]; total: number };

const UNASSIGNED_EVENT_KEY = "__unassigned__";

/**
 * `projectIds` restricts which projects' time counts (independent of `axis` —
 * you can break down by Phase while still only looking at one project's time).
 * `"unassigned"` in the list additionally includes projectless entries; pass
 * `null`/undefined for no project filtering at all.
 * `clientIds` further restricts to projects belonging to one of those clients
 * (ANDed with `projectIds`, not ORed — an projectless entry never has a client).
 * `descriptionQuery` is a case-insensitive substring match against the entry
 * description, applied in JS since SQLite's Prisma provider has no
 * case-insensitive `contains` mode.
 */
export async function getOverviewData(
  selectedUsers: { id: string; name: string }[],
  period: TimePeriod,
  anchor: Date,
  axis: OverviewAxis = "person",
  projectIds?: string[] | null,
  clientIds?: string[] | null,
  descriptionQuery?: string | null
) {
  const from = rangeStart(period, anchor);
  const to = rangeEnd(period, anchor);
  const buckets = overviewBuckets(period, from, to);

  if (selectedUsers.length === 0) return { from, to, buckets, rows: [] as OverviewRow[] };

  const wantsUnassigned = projectIds?.includes("unassigned") ?? false;
  const specificProjectIds = projectIds?.filter((id) => id !== "unassigned") ?? [];

  let entries = await prisma.timeEntry.findMany({
    where: {
      userId: { in: selectedUsers.map((u) => u.id) },
      running: false,
      date: { gte: from, lt: to },
      ...(projectIds && projectIds.length > 0
        ? {
            OR: [
              ...(specificProjectIds.length > 0 ? [{ projectId: { in: specificProjectIds } }] : []),
              ...(wantsUnassigned ? [{ projectId: null }] : []),
            ],
          }
        : {}),
      ...(clientIds && clientIds.length > 0 ? { project: { clientId: { in: clientIds } } } : {}),
    },
    select: {
      userId: true,
      projectId: true,
      phase: true,
      minutes: true,
      date: true,
      description: true,
      project: { select: { title: true } },
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
  } else if (axis === "project") {
    const byProject = new Map<string, { name: string | null; entries: typeof entries }>();
    for (const e of entries) {
      const key = e.projectId ?? UNASSIGNED_EVENT_KEY;
      const group = byProject.get(key) ?? { name: e.project?.title ?? null, entries: [] };
      group.entries.push(e);
      byProject.set(key, group);
    }
    rows = [...byProject.entries()]
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
