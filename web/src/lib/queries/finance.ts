import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  quoteWhereForUser,
  invoiceWhereForUser,
  expenseWhereForUser,
  eventWhereForUser,
  type SessionUser,
} from "@/lib/authz";
import type { ExpenseCategory, Prisma, QuoteStatus } from "@/generated/prisma/client";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isOverdue(invoice: { status: string; dueDate: Date }) {
  return invoice.status !== "PAID" && invoice.dueDate.getTime() < Date.now();
}

export function overdueDays(invoice: { dueDate: Date }) {
  return Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / 86400000));
}

// --- Shared list sort ---

/** Sort a quote/invoice list by issue date or document number, either way. */
export type FinanceSort = "date_desc" | "date_asc" | "number_desc" | "number_asc";

export function financeOrderBy(sort: string | undefined): { issuedAt: "asc" | "desc" } | { number: "asc" | "desc" } {
  switch (sort) {
    case "date_asc":
      return { issuedAt: "asc" };
    case "number_desc":
      return { number: "desc" };
    case "number_asc":
      return { number: "asc" };
    default:
      return { issuedAt: "desc" };
  }
}

// --- Quotes ---

export type QuoteListFilters = { q?: string; status?: QuoteStatus; eventId?: string; year?: number; sort?: string };

export async function getQuoteList(user: SessionUser, filters: QuoteListFilters) {
  const year = filters.year ?? new Date().getFullYear();
  const where: Prisma.QuoteWhereInput = {
    ...quoteWhereForUser(user),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    issuedAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q } },
            { event: { title: { contains: filters.q } } },
            { event: { companyName: { contains: filters.q } } },
          ],
        }
      : {}),
  };

  const [quotes, openValue, events] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: { event: true, invoices: { select: { id: true, number: true } } },
      orderBy: financeOrderBy(filters.sort),
    }),
    prisma.quote.aggregate({
      where: { ...quoteWhereForUser(user), status: { in: ["DRAFT", "SENT"] } },
      _sum: { total: true },
    }),
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true, status: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return { quotes, openValue: openValue._sum.total ?? 0, events, year };
}

export const getQuoteDetail = cache(async function getQuoteDetail(user: SessionUser, id: string) {
  return prisma.quote.findFirst({
    where: { id, ...quoteWhereForUser(user) },
    include: {
      event: { include: { client: true } },
      items: { orderBy: { sortOrder: "asc" } },
      invoices: true,
      createdBy: true,
    },
  });
});

// --- Invoices ---

export type InvoiceListFilters = { bucket?: "issued" | "paid" | "overdue" | "partly_paid"; eventId?: string; sort?: string };

export async function getInvoiceList(user: SessionUser, filters: InvoiceListFilters) {
  const where: Prisma.InvoiceWhereInput = {
    ...invoiceWhereForUser(user),
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
  };

  const all = await prisma.invoice.findMany({
    where,
    include: { event: true },
    orderBy: financeOrderBy(filters.sort),
  });

  const filtered = all.filter((inv) => {
    if (!filters.bucket) return true;
    if (filters.bucket === "overdue") return isOverdue(inv);
    if (filters.bucket === "issued") return inv.status === "ISSUED";
    if (filters.bucket === "paid") return inv.status === "PAID";
    if (filters.bucket === "partly_paid") return inv.status === "PARTLY_PAID";
    return true;
  });

  const events = await prisma.event.findMany({
    where: eventWhereForUser(user),
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });

  return { invoices: filtered, total: all.length, events };
}

export async function getInvoiceKpis(user: SessionUser) {
  const invoices = await prisma.invoice.findMany({
    where: invoiceWhereForUser(user),
    select: { total: true, amountPaid: true, status: true, dueDate: true, paidAt: true },
  });

  const now = new Date();
  const in7 = new Date(now.getTime() + SEVEN_DAYS_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const unpaid = invoices.filter((i) => i.status !== "PAID");
  const overdue = unpaid.filter((i) => i.dueDate < now);
  const dueSoon = unpaid.filter((i) => i.dueDate >= now && i.dueDate <= in7);
  const paidThisMonth = invoices.filter((i) => i.status === "PAID" && i.paidAt && i.paidAt >= monthStart);

  const remaining = (i: { total: number; amountPaid: number }) => i.total - i.amountPaid;

  return {
    issuedUnpaid: { count: unpaid.length, total: unpaid.reduce((s, i) => s + remaining(i), 0) },
    overdue: { count: overdue.length, total: overdue.reduce((s, i) => s + remaining(i), 0) },
    dueSoon: { count: dueSoon.length, total: dueSoon.reduce((s, i) => s + remaining(i), 0) },
    paidThisMonth: { count: paidThisMonth.length, total: paidThisMonth.reduce((s, i) => s + i.total, 0) },
  };
}

export const getInvoiceDetail = cache(async function getInvoiceDetail(user: SessionUser, id: string) {
  return prisma.invoice.findFirst({
    where: { id, ...invoiceWhereForUser(user) },
    include: {
      // client + contacts are only needed to resolve who an invoice email goes to
      // (Client.invoicingEmail first, else the event's first contact with an email).
      event: { include: { client: true, contacts: { orderBy: { sortOrder: "asc" } } } },
      quote: true,
      items: { orderBy: { sortOrder: "asc" } },
      payments: { include: { recordedBy: true }, orderBy: { date: "desc" } },
      history: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });
});

// --- Expenses ---

export type ExpenseListFilters = { eventId?: string; category?: ExpenseCategory };

export async function getExpenseList(user: SessionUser, filters: ExpenseListFilters) {
  const where: Prisma.ExpenseWhereInput = {
    ...expenseWhereForUser(user),
    ...(filters.eventId ? (filters.eventId === "overhead" ? { eventId: null } : { eventId: filters.eventId }) : {}),
    ...(filters.category ? { category: filters.category } : {}),
  };

  const [expenses, events] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { event: true, paidBy: true },
      orderBy: { date: "desc" },
    }),
    prisma.event.findMany({ where: eventWhereForUser(user), select: { id: true, title: true, status: true }, orderBy: { title: "asc" } }),
  ]);

  return { expenses, total: expenses.reduce((s, e) => s + e.amount, 0), events };
}

// --- Reports ---

export async function getReports(user: SessionUser, year: number) {
  const invoiceWhere = invoiceWhereForUser(user);
  const expenseWhere = expenseWhereForUser(user);
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year + 1}-01-01`);

  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...invoiceWhere, issuedAt: { gte: yearStart, lt: yearEnd } },
      select: { total: true, issuedAt: true, event: { select: { id: true, title: true } } },
    }),
    prisma.expense.findMany({
      where: { ...expenseWhere, date: { gte: yearStart, lt: yearEnd } },
      select: { amount: true, date: true, category: true, event: { select: { id: true, title: true } } },
    }),
  ]);

  const income = invoices.reduce((s, i) => s + i.total, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = income - expenseTotal;
  const margin = income > 0 ? Math.round((balance / income) * 100) : 0;

  const byMonth = new Map<number, { month: number; income: number; expense: number }>();
  for (let m = 0; m < 12; m++) byMonth.set(m, { month: m, income: 0, expense: 0 });
  for (const inv of invoices) byMonth.get(inv.issuedAt.getMonth())!.income += inv.total;
  for (const exp of expenses) byMonth.get(exp.date.getMonth())!.expense += exp.amount;

  const byEvent = new Map<string, { id: string; title: string; income: number; expense: number }>();
  const touchEvent = (id: string, title: string) => {
    if (!byEvent.has(id)) byEvent.set(id, { id, title, income: 0, expense: 0 });
    return byEvent.get(id)!;
  };
  for (const inv of invoices) if (inv.event) touchEvent(inv.event.id, inv.event.title).income += inv.total;
  for (const exp of expenses) if (exp.event) touchEvent(exp.event.id, exp.event.title).expense += exp.amount;

  const byCategory = new Map<string, number>();
  for (const exp of expenses) byCategory.set(exp.category, (byCategory.get(exp.category) ?? 0) + exp.amount);
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return {
    year,
    income,
    expense: expenseTotal,
    balance,
    margin,
    byMonth: [...byMonth.values()],
    byEvent: [...byEvent.values()].sort((a, b) => b.income + b.expense - (a.income + a.expense)),
    topCategories,
  };
}

export async function getCompanySettings() {
  return prisma.companySettings.findUnique({ where: { id: "singleton" } });
}
