import { prisma } from "@/lib/prisma";
import {
  projectWhereForUser,
  expenseWhereForUser,
  assignedProjectWhere,
  canEditProject,
  canManageFinance,
  canManageMeetings,
  canViewExpenses,
  canViewMeetings,
  dashboardVariant,
  type SessionUser,
} from "@/lib/authz";
import { toCzkBatch } from "@/lib/fx";
import { expandMeetingOccurrences } from "@/lib/meetings";
import { pragueInstant } from "@/lib/routing";
import { monthKeyOf, pragueDateKey, shiftMonth } from "@/lib/prague-date";
import { projectHref } from "@/lib/slug";
import type { DashProject } from "@/lib/dashboard-types";
import type { Prisma } from "@/generated/prisma/client";

const DAY_MS = 86_400_000;

function daysBetween(a: Date, b: Date) {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / DAY_MS);
}

// --- shared building blocks ---------------------------------------------------

async function overdueInvoices(projectWhere: Prisma.ProjectWhereInput) {
  const now = new Date();
  const rows = await prisma.invoice.findMany({
    where: { status: { not: "PAID" }, dueDate: { lt: now }, project: projectWhere },
    include: { project: { select: { id: true, number: true, title: true } } },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((i) => ({
    id: i.id,
    number: i.number,
    total: i.total,
    currency: i.currency,
    issuedAt: i.issuedAt,
    daysOverdue: daysBetween(now, i.dueDate),
    project: i.project,
  }));
}

async function waitingQuotes(projectWhere: Prisma.ProjectWhereInput) {
  const now = new Date();
  const rows = await prisma.quote.findMany({
    where: { status: "SENT", project: projectWhere },
    include: { project: { select: { id: true, number: true, title: true } } },
    orderBy: { issuedAt: "asc" },
  });
  return rows.map((q) => ({
    id: q.id,
    number: q.number,
    total: q.total,
    subtotal: q.subtotal,
    currency: q.currency,
    issuedAt: q.issuedAt,
    daysSinceSent: daysBetween(now, q.issuedAt),
    project: q.project,
  }));
}

async function projectsToInvoice(projectWhere: Prisma.ProjectWhereInput) {
  return prisma.project.findMany({
    where: { ...projectWhere, status: "TO_INVOICE" },
    select: { id: true, number: true, title: true, companyName: true, startDate: true, endDate: true },
    orderBy: { endDate: "asc" },
  });
}



/**
 * Money movement in the current Prague calendar month. Non-CZK invoices and
 * payments convert to CZK at the CNB fixing rate on the parent invoice's
 * issue date (see src/lib/fx.ts) rather than summing raw cross-currency amounts.
 */
export async function getMonthlyCashflow() {
  const month = monthKeyOf(pragueDateKey(new Date()));
  const monthStart = pragueInstant(`${month}-01`, 0);
  const monthEnd = pragueInstant(`${shiftMonth(month, 1)}-01`, 0);

  const [invoicedRows, paidRows, expenseAgg, unpaidRows] = await Promise.all([
    prisma.invoice.findMany({
      where: { issuedAt: { gte: monthStart, lt: monthEnd } },
      select: { total: true, currency: true, issuedAt: true },
    }),
    prisma.payment.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      select: { amount: true, invoice: { select: { currency: true, issuedAt: true } } },
    }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart, lt: monthEnd } } }),
    prisma.invoice.findMany({
      where: { status: { not: "PAID" } },
      select: { total: true, amountPaid: true, currency: true, issuedAt: true },
    }),
  ]);

  const [invoicedCzk, paidCzk, outstandingCzk] = await Promise.all([
    toCzkBatch(invoicedRows.map((i) => ({ amount: i.total, currency: i.currency, date: i.issuedAt }))),
    toCzkBatch(paidRows.map((p) => ({ amount: p.amount, currency: p.invoice.currency, date: p.invoice.issuedAt }))),
    toCzkBatch(unpaidRows.map((i) => ({ amount: i.total - i.amountPaid, currency: i.currency, date: i.issuedAt }))),
  ]);

  return {
    month,
    invoiced: invoicedCzk.reduce((s, i) => s + i.czkAmount, 0),
    paid: paidCzk.reduce((s, i) => s + i.czkAmount, 0),
    outstanding: outstandingCzk.reduce((s, i) => s + i.czkAmount, 0),
    expenses: expenseAgg._sum.amount ?? 0,
  };
}

// --- Dashboard ---------------------------------------------------------------

/**
 * Which projects the dashboard covers: everything a company-wide role can see,
 * or only the projects a Producer or Member is on, as the role dashboards did
 * before the single-layout redesign.
 */
function dashboardProjectWhere(user: SessionUser): Prisma.ProjectWhereInput {
  const variant = dashboardVariant(user);
  return variant === "admin" || variant === "accountant" ? projectWhereForUser(user) : assignedProjectWhere(user);
}

const NOT_CANCELLED: Prisma.ProjectWhereInput = { status: { not: "CANCELLED" } };

function projectInclude(now: Date) {
  return {
    venues: { take: 1 },
    roadmapItems: { where: { date: { gte: now }, done: false }, orderBy: { date: "asc" as const }, take: 1 },
  } satisfies Prisma.ProjectInclude;
}

type ProjectRow = Prisma.ProjectGetPayload<{ include: ReturnType<typeof projectInclude> }>;

/** Plain, serializable project shape the dashboard's client components share. No prices on purpose. */
function toDashProject(p: ProjectRow): DashProject {
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    client: p.companyName,
    status: p.status,
    start: p.startDate.toISOString(),
    end: p.endDate.toISOString(),
    venue: p.venues[0]?.name ?? null,
    nextMilestone: p.roadmapItems[0] ? { title: p.roadmapItems[0].title, date: p.roadmapItems[0].date.toISOString() } : null,
    href: projectHref(p),
  };
}

/** Projects overlapping a Prague calendar month, for the dashboard calendar. */
export async function getDashboardMonth(user: SessionUser, month: string): Promise<DashProject[]> {
  const now = new Date();
  const start = pragueInstant(`${month}-01`, 0);
  const end = pragueInstant(`${shiftMonth(month, 1)}-01`, 0);
  const rows = await prisma.project.findMany({
    where: { AND: [dashboardProjectWhere(user), NOT_CANCELLED, { startDate: { lt: end } }, { endDate: { gte: start } }] },
    include: projectInclude(now),
    orderBy: { startDate: "asc" },
  });
  return rows.map(toDashProject);
}

const UPCOMING_LIMIT = 8;
const TASK_LIMIT = 6;
const MEETING_DAYS = 30;
const MEETING_LIMIT = 4;
const EXPENSE_LIMIT = 5;

export async function getDashboardData(user: SessionUser) {
  const now = new Date();
  const today = pragueDateKey(now);
  const todayStart = pragueInstant(today, 0);
  const projectWhere = dashboardProjectWhere(user);
  const showFinance = canManageFinance(user);
  const showExpenses = canViewExpenses(user);
  const showMeetings = canViewMeetings(user);

  const [upcoming, month, tasks, meetings, expenses, finance] = await Promise.all([
    // A project still running today counts as upcoming; one that ended before today doesn't.
    prisma.project.findMany({
      where: { AND: [projectWhere, NOT_CANCELLED, { endDate: { gte: todayStart } }] },
      include: projectInclude(now),
      orderBy: { startDate: "asc" },
      take: UPCOMING_LIMIT,
    }),
    getDashboardMonth(user, monthKeyOf(today)),
    prisma.roadmapItem.findMany({
      where: { type: "TASK", done: false, project: { AND: [projectWhere, NOT_CANCELLED] } },
      include: { project: { include: { members: { select: { userId: true } } } } },
      orderBy: { date: "asc" },
      take: TASK_LIMIT,
    }),
    showMeetings
      ? prisma.meeting.findMany({ include: { exceptions: true } })
      : Promise.resolve([]),
    showExpenses
      ? prisma.expense.findMany({
          where: expenseWhereForUser(user),
          include: { project: { include: projectInclude(now) } },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: EXPENSE_LIMIT,
        })
      : Promise.resolve([]),
    showFinance ? getFinanceSummary(projectWhere) : Promise.resolve(null),
  ]);

  const meetingEnd = new Date(now.getTime() + MEETING_DAYS * DAY_MS);
  const meetingOccurrences = meetings
    .flatMap((m) =>
      expandMeetingOccurrences(m, now, meetingEnd, m.exceptions).map((o) => ({
        key: `${m.id}:${o.originalDate.toISOString()}`,
        id: m.id,
        title: m.title,
        type: m.type,
        allDay: m.allDay,
        date: o.date.toISOString(),
      }))
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MEETING_LIMIT);

  return {
    today,
    upcoming: upcoming.map(toDashProject),
    month: { key: monthKeyOf(today), projects: month },
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      date: task.date.toISOString(),
      projectTitle: task.project.title,
      projectHref: projectHref(task.project, "/roadmap"),
      editable: canEditProject(user, { ownerId: task.project.ownerId, memberIds: task.project.members.map((m) => m.userId) }),
    })),
    meetings: showMeetings ? meetingOccurrences : null,
    canCreateMeeting: canManageMeetings(user),
    expenses: showExpenses
      ? expenses.map((e) => ({
          id: e.id,
          note: e.note,
          category: e.category,
          amount: e.amount,
          date: e.date.toISOString(),
          project: e.project ? toDashProject(e.project) : null,
        }))
      : null,
    finance,
  };
}

async function getFinanceSummary(projectWhere: Prisma.ProjectWhereInput) {
  const [overdue, quotes, toInvoice, cashflow] = await Promise.all([
    overdueInvoices(projectWhere),
    waitingQuotes(projectWhere),
    projectsToInvoice(projectWhere),
    getMonthlyCashflow(),
  ]);
  const [overdueCzk, quotesCzk] = await Promise.all([
    // Overdue is real money owed (incl. VAT); quotes aren't invoiced yet, so
    // they're pipeline value, excl. VAT.
    toCzkBatch(overdue.map((i) => ({ amount: i.total, currency: i.currency, date: i.issuedAt }))),
    toCzkBatch(quotes.map((q) => ({ amount: q.subtotal, currency: q.currency, date: q.issuedAt }))),
  ]);
  return {
    overdue: { count: overdue.length, total: overdueCzk.reduce((s, i) => s + i.czkAmount, 0) },
    quotes: { count: quotes.length, total: quotesCzk.reduce((s, q) => s + q.czkAmount, 0) },
    toInvoice: { count: toInvoice.length, first: toInvoice[0]?.title ?? null },
    cashflow,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
