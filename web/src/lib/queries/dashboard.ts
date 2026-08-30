import { prisma } from "@/lib/prisma";
import {
  eventWhereForUser,
  expenseWhereForUser,
  assignedEventWhere,
  canViewEventBudget,
  type SessionUser,
} from "@/lib/authz";
import { resolveEventBudget } from "@/lib/event-budget";
import type { Prisma } from "@/generated/prisma/client";
import type { EventStatus } from "@/generated/prisma/enums";

const DAY_MS = 86_400_000;
const ACTIVE_STATUSES: { notIn: EventStatus[] } = { notIn: ["CANCELLED", "CLOSED"] };

function daysBetween(a: Date, b: Date) {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / DAY_MS);
}

// --- shared building blocks ---------------------------------------------------

async function overdueInvoices(eventWhere: Prisma.EventWhereInput) {
  const now = new Date();
  const rows = await prisma.invoice.findMany({
    where: { status: { not: "PAID" }, dueDate: { lt: now }, event: eventWhere },
    include: { event: { select: { id: true, title: true } } },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((i) => ({
    id: i.id,
    number: i.number,
    total: i.total,
    currency: i.currency,
    daysOverdue: daysBetween(now, i.dueDate),
    event: i.event,
  }));
}

async function waitingQuotes(eventWhere: Prisma.EventWhereInput) {
  const now = new Date();
  const rows = await prisma.quote.findMany({
    where: { status: "SENT", event: eventWhere },
    include: { event: { select: { id: true, title: true } } },
    orderBy: { issuedAt: "asc" },
  });
  return rows.map((q) => ({
    id: q.id,
    number: q.number,
    total: q.total,
    currency: q.currency,
    daysSinceSent: daysBetween(now, q.issuedAt),
    event: q.event,
  }));
}

async function eventsToInvoice(eventWhere: Prisma.EventWhereInput) {
  return prisma.event.findMany({
    where: { ...eventWhere, status: "TO_INVOICE" },
    select: { id: true, title: true, companyName: true, startDate: true, endDate: true },
    orderBy: { endDate: "asc" },
  });
}

async function upcomingEvents(eventWhere: Prisma.EventWhereInput, take: number) {
  const now = new Date();
  return prisma.event.findMany({
    where: { ...eventWhere, endDate: { gte: now }, status: ACTIVE_STATUSES },
    include: {
      venues: { take: 1 },
      roadmapItems: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1 },
    },
    orderBy: { startDate: "asc" },
    take,
  });
}

async function latestExpenses(expenseWhere: Prisma.ExpenseWhereInput, take: number) {
  return prisma.expense.findMany({
    where: expenseWhere,
    include: {
      event: { select: { id: true, title: true } },
      paidBy: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take,
  });
}

/**
 * Current calendar month's money movement. Raw cross-currency sums labelled
 * CZK downstream — the same deliberate no-FX simplification the Reports and
 * client rollups use (see CLAUDE.md).
 */
export async function getMonthlyCashflow() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [invoicedAgg, paidAgg, expenseAgg, unpaid] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { total: true }, where: { issuedAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart, lt: monthEnd } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart, lt: monthEnd } } }),
    prisma.invoice.findMany({ where: { status: { not: "PAID" } }, select: { total: true, amountPaid: true } }),
  ]);

  return {
    monthStart,
    invoiced: invoicedAgg._sum.total ?? 0,
    paid: paidAgg._sum.amount ?? 0,
    outstanding: unpaid.reduce((s, i) => s + (i.total - i.amountPaid), 0),
    expenses: expenseAgg._sum.amount ?? 0,
  };
}

// --- Admin -------------------------------------------------------------------

export async function getAdminDashboard(user: SessionUser) {
  const eventWhere = eventWhereForUser(user);
  const expenseWhere = expenseWhereForUser(user);
  const now = new Date();

  const [activeEvents, overdue, quotes, toInvoice, upcoming, expenses, cashflow] = await Promise.all([
    prisma.event.count({ where: { ...eventWhere, status: ACTIVE_STATUSES } }),
    overdueInvoices(eventWhere),
    waitingQuotes(eventWhere),
    eventsToInvoice(eventWhere),
    upcomingEvents(eventWhere, 3),
    latestExpenses(expenseWhere, 5),
    getMonthlyCashflow(),
  ]);

  return {
    activeEvents,
    endingThisMonth: upcoming.filter((e) => e.endDate < new Date(now.getFullYear(), now.getMonth() + 1, 1)).length,
    overdue: { count: overdue.length, total: overdue.reduce((s, i) => s + i.total, 0), oldestDays: overdue[0]?.daysOverdue ?? 0 },
    quotes: {
      count: quotes.length,
      total: quotes.reduce((s, q) => s + q.total, 0),
      rangeDays: quotes.length
        ? ([quotes[quotes.length - 1].daysSinceSent, quotes[0].daysSinceSent] as const)
        : ([0, 0] as const),
    },
    toInvoice,
    upcoming,
    expenses,
    cashflow,
  };
}

// --- Accountant -------------------------------------------------------------

export async function getAccountantDashboard(user: SessionUser) {
  const eventWhere = eventWhereForUser(user);
  const expenseWhere = expenseWhereForUser(user);

  const [overdue, quotes, toInvoice, expenses, cashflow] = await Promise.all([
    overdueInvoices(eventWhere),
    waitingQuotes(eventWhere),
    eventsToInvoice(eventWhere),
    latestExpenses(expenseWhere, 6),
    getMonthlyCashflow(),
  ]);

  return { overdue, quotes, toInvoice, expenses, cashflow };
}

// --- Producer --------------------------------------------------------------

export async function getProducerDashboard(user: SessionUser) {
  const mine = assignedEventWhere(user);
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * DAY_MS);
  const showBudget = canViewEventBudget(user);

  const [events, roadmap] = await Promise.all([
    prisma.event.findMany({
      where: { ...mine, endDate: { gte: now }, status: ACTIVE_STATUSES },
      include: {
        venues: { take: 1 },
        roadmapItems: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1 },
        expenses: { select: { amount: true } },
      },
      orderBy: { startDate: "asc" },
      take: 6,
    }),
    prisma.roadmapItem.findMany({
      where: { assignees: { some: { userId: user.id } }, done: false, date: { gte: now, lte: horizon } },
      include: { event: { select: { id: true, title: true } } },
      orderBy: { date: "asc" },
      take: 8,
    }),
  ]);

  const myEvents = events.map((e) => {
    const spent = e.expenses.reduce((s, x) => s + x.amount, 0);
    const budget = showBudget ? resolveEventBudget(e) : { type: "NONE" as const, value: 0, amount: null };
    return {
      id: e.id,
      title: e.title,
      companyName: e.companyName,
      status: e.status,
      startDate: e.startDate,
      endDate: e.endDate,
      venue: e.venues[0]?.name ?? null,
      nextItem: e.roadmapItems[0] ? { title: e.roadmapItems[0].title, date: e.roadmapItems[0].date } : null,
      budgetAmount: budget.amount,
      spent,
    };
  });

  return { myEvents, roadmap };
}

// --- Member ---------------------------------------------------------------

export async function getMemberDashboard(user: SessionUser) {
  const mine = assignedEventWhere(user);
  const now = new Date();

  const [events, expenses] = await Promise.all([
    prisma.event.findMany({
      where: { ...mine, endDate: { gte: now }, status: ACTIVE_STATUSES },
      include: {
        venues: { take: 1 },
        roadmapItems: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1 },
      },
      orderBy: { startDate: "asc" },
      take: 4,
    }),
    prisma.expense.findMany({
      where: { paidById: user.id },
      include: {
        event: { select: { id: true, title: true } },
        paidBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 6,
    }),
  ]);

  return { events, expenses };
}
