import { prisma } from "@/lib/prisma";
import { eventWhereForUser, expenseWhereForUser, type SessionUser } from "@/lib/authz";

export async function getDashboardData(user: SessionUser) {
  const eventWhere = eventWhereForUser(user);
  const expenseWhere = expenseWhereForUser(user);
  const now = new Date();

  const [overdueInvoices, waitingQuotes, eventsToInvoice, upcomingEvents, latestExpenses] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { status: { not: "PAID" }, dueDate: { lt: now }, event: eventWhere },
        include: { event: true },
        orderBy: { dueDate: "asc" },
      }),
      prisma.quote.findMany({
        where: { status: "SENT", event: eventWhere },
        include: { event: true },
        orderBy: { issuedAt: "asc" },
      }),
      prisma.event.findMany({
        where: { ...eventWhere, status: "TO_INVOICE" },
        orderBy: { endDate: "asc" },
      }),
      prisma.event.findMany({
        where: { ...eventWhere, endDate: { gte: now }, status: { notIn: ["CANCELLED", "CLOSED"] } },
        include: { venues: true, milestones: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1 } },
        orderBy: { startDate: "asc" },
        take: 3,
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        include: { event: true },
        orderBy: { date: "desc" },
        take: 4,
      }),
    ]);

  const oldestOverdueDays = overdueInvoices.length
    ? Math.max(...overdueInvoices.map((i) => Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000)))
    : 0;
  const newestQuoteDays = waitingQuotes.length
    ? Math.min(...waitingQuotes.map((q) => Math.floor((now.getTime() - q.issuedAt.getTime()) / 86400000)))
    : 0;
  const oldestQuoteDays = waitingQuotes.length
    ? Math.max(...waitingQuotes.map((q) => Math.floor((now.getTime() - q.issuedAt.getTime()) / 86400000)))
    : 0;

  return {
    needsAttention: {
      overdueInvoices: {
        count: overdueInvoices.length,
        total: overdueInvoices.reduce((s, i) => s + i.total, 0),
        oldestDays: oldestOverdueDays,
      },
      waitingQuotes: {
        count: waitingQuotes.length,
        total: waitingQuotes.reduce((s, q) => s + q.total, 0),
        rangeDays: [newestQuoteDays, oldestQuoteDays] as const,
      },
      eventsToInvoice: {
        count: eventsToInvoice.length,
        first: eventsToInvoice[0] ?? null,
      },
    },
    upcomingEvents,
    latestExpenses,
  };
}

export type TimelineItem = { date: Date; kind: "build" | "start" | "milestone"; label: string; eventId: string; eventTitle: string };

/** Chronological feed for the Dashboard's Timeline view: build/start days + milestones, next 60 days. */
export async function getDashboardTimeline(user: SessionUser): Promise<TimelineItem[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 86400000);

  const events = await prisma.event.findMany({
    where: { ...eventWhereForUser(user), status: { notIn: ["CANCELLED", "CLOSED"] }, startDate: { lte: horizon }, endDate: { gte: now } },
    include: { milestones: { where: { date: { gte: now, lte: horizon } } } },
    orderBy: { startDate: "asc" },
    take: 20,
  });

  const items: TimelineItem[] = [];
  for (const e of events) {
    const buildOrStart = e.buildDate ?? e.startDate;
    if (buildOrStart >= now) {
      items.push({ date: buildOrStart, kind: e.buildDate ? "build" : "start", label: e.buildDate ? "Build day" : "Event begins", eventId: e.id, eventTitle: e.title });
    } else if (e.startDate >= now) {
      items.push({ date: e.startDate, kind: "start", label: "Event begins", eventId: e.id, eventTitle: e.title });
    }
    for (const m of e.milestones) {
      items.push({ date: m.date, kind: "milestone", label: m.title, eventId: e.id, eventTitle: e.title });
    }
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
