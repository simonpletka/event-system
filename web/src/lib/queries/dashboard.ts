import { prisma } from "@/lib/prisma";
import { eventWhereForUser, expenseWhereForUser, type SessionUser } from "@/lib/authz";

export async function getDashboardData(user: SessionUser) {
  const eventWhere = eventWhereForUser(user);
  const expenseWhere = expenseWhereForUser(user);
  const now = new Date();

  const [overdueInvoices, waitingQuotes, eventsToInvoice, upcomingEvents, latestExpenses, allInvoices, allExpenses] =
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
      prisma.invoice.findMany({ where: { event: eventWhere }, select: { total: true, issuedAt: true } }),
      prisma.expense.findMany({ where: expenseWhere, select: { amount: true, date: true } }),
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

  const monthly = buildMonthlyBalance(allInvoices, allExpenses);

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
    monthly,
  };
}

function buildMonthlyBalance(
  invoices: { total: number; issuedAt: Date }[],
  expenses: { amount: number; date: Date }[]
) {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const label = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });

  const months = new Map<string, { label: string; income: number; expense: number; order: number }>();
  const touch = (d: Date) => {
    const k = key(d);
    if (!months.has(k)) {
      months.set(k, { label: label(d), income: 0, expense: 0, order: d.getFullYear() * 12 + d.getMonth() });
    }
    return months.get(k)!;
  };

  for (const inv of invoices) touch(inv.issuedAt).income += inv.total;
  for (const exp of expenses) touch(exp.date).expense += exp.amount;

  return [...months.values()].sort((a, b) => a.order - b.order).slice(-4);
}
