import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  quoteWhereForUser,
  invoiceWhereForUser,
  expenseWhereForUser,
  projectWhereForUser,
  type SessionUser,
} from "@/lib/authz";
import type { ExpenseCategory, Prisma, QuoteStatus } from "@/generated/prisma/client";
import { toCzkBatch } from "@/lib/fx";
import { isMixedCurrencyTotal, type CurrencyCode } from "@/lib/format";
import { vatBucketsForInvoice } from "@/lib/vat";
import { classifyRegime, type VatRegime } from "@/lib/vat-regime";
import { reportBuckets, resolveRange, type ReportPeriod } from "@/lib/finance-period";
import type { Locale } from "@/lib/dictionary";

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

export type QuoteListFilters = { q?: string; status?: QuoteStatus; projectId?: string; year?: number; sort?: string };

export async function getQuoteList(user: SessionUser, filters: QuoteListFilters) {
  const year = filters.year ?? new Date().getFullYear();
  const where: Prisma.QuoteWhereInput = {
    ...quoteWhereForUser(user),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    issuedAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q } },
            { project: { title: { contains: filters.q } } },
            { project: { companyName: { contains: filters.q } } },
          ],
        }
      : {}),
  };

  const [quotes, openQuotes, projects] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: { project: true, invoices: { select: { id: true, number: true } } },
      orderBy: financeOrderBy(filters.sort),
    }),
    prisma.quote.findMany({
      where: { ...quoteWhereForUser(user), status: { in: ["DRAFT", "SENT"] } },
      select: { subtotal: true, currency: true, issuedAt: true },
    }),
    prisma.project.findMany({
      where: projectWhereForUser(user),
      select: { id: true, title: true, status: true },
      orderBy: { title: "asc" },
    }),
  ]);

  // Excl. VAT — nothing's been invoiced yet, so this is pipeline value, not
  // money owed (unlike getInvoiceKpis' payment-tracking totals below).
  const openValue = (
    await toCzkBatch(openQuotes.map((q) => ({ amount: q.subtotal, currency: q.currency, date: q.issuedAt })))
  ).reduce((s, q) => s + q.czkAmount, 0);

  return { quotes, openValue, projects, year };
}

export const getQuoteDetail = cache(async function getQuoteDetail(user: SessionUser, id: string) {
  return prisma.quote.findFirst({
    where: { id, ...quoteWhereForUser(user) },
    include: {
      project: { include: { client: true } },
      items: { orderBy: { sortOrder: "asc" } },
      invoices: true,
      createdBy: true,
    },
  });
});

// --- Invoices ---

export type InvoiceListFilters = { bucket?: "issued" | "paid" | "overdue" | "partly_paid"; projectId?: string; sort?: string };

export async function getInvoiceList(user: SessionUser, filters: InvoiceListFilters) {
  const where: Prisma.InvoiceWhereInput = {
    ...invoiceWhereForUser(user),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
  };

  const all = await prisma.invoice.findMany({
    where,
    include: { project: true },
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

  const projects = await prisma.project.findMany({
    where: projectWhereForUser(user),
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
  });

  return { invoices: filtered, total: all.length, projects };
}

export async function getInvoiceKpis(user: SessionUser) {
  const invoices = await prisma.invoice.findMany({
    where: invoiceWhereForUser(user),
    select: { total: true, amountPaid: true, status: true, dueDate: true, paidAt: true, currency: true, issuedAt: true },
  });

  const now = new Date();
  const in7 = new Date(now.getTime() + SEVEN_DAYS_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const unpaid = invoices.filter((i) => i.status !== "PAID");
  const overdue = unpaid.filter((i) => i.dueDate < now);
  const dueSoon = unpaid.filter((i) => i.dueDate >= now && i.dueDate <= in7);
  const paidThisMonth = invoices.filter((i) => i.status === "PAID" && i.paidAt && i.paidAt >= monthStart);

  const remaining = (i: { total: number; amountPaid: number }) => i.total - i.amountPaid;
  const czkSum = async (items: { amount: number; currency: CurrencyCode; date: Date }[]) =>
    (await toCzkBatch(items)).reduce((s, i) => s + i.czkAmount, 0);

  const [issuedUnpaidTotal, overdueTotal, dueSoonTotal, paidThisMonthTotal] = await Promise.all([
    czkSum(unpaid.map((i) => ({ amount: remaining(i), currency: i.currency, date: i.issuedAt }))),
    czkSum(overdue.map((i) => ({ amount: remaining(i), currency: i.currency, date: i.issuedAt }))),
    czkSum(dueSoon.map((i) => ({ amount: remaining(i), currency: i.currency, date: i.issuedAt }))),
    czkSum(paidThisMonth.map((i) => ({ amount: i.total, currency: i.currency, date: i.issuedAt }))),
  ]);

  return {
    issuedUnpaid: { count: unpaid.length, total: issuedUnpaidTotal },
    overdue: { count: overdue.length, total: overdueTotal },
    dueSoon: { count: dueSoon.length, total: dueSoonTotal },
    paidThisMonth: { count: paidThisMonth.length, total: paidThisMonthTotal },
  };
}

export const getInvoiceDetail = cache(async function getInvoiceDetail(user: SessionUser, id: string) {
  return prisma.invoice.findFirst({
    where: { id, ...invoiceWhereForUser(user) },
    include: {
      // client + contacts are only needed to resolve who an invoice email goes to
      // (Client.invoicingEmail first, else the project's first contact with an email).
      project: { include: { client: true, contacts: { orderBy: { sortOrder: "asc" } } } },
      quote: true,
      items: { orderBy: { sortOrder: "asc" } },
      payments: { include: { recordedBy: true }, orderBy: { date: "desc" } },
      history: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });
});

// --- Expenses ---

export type ExpenseListFilters = { projectId?: string; category?: ExpenseCategory };

export async function getExpenseList(user: SessionUser, filters: ExpenseListFilters) {
  const where: Prisma.ExpenseWhereInput = {
    ...expenseWhereForUser(user),
    ...(filters.projectId ? (filters.projectId === "overhead" ? { projectId: null } : { projectId: filters.projectId }) : {}),
    ...(filters.category ? { category: filters.category } : {}),
  };

  const [expenses, projects] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { project: true, paidBy: true },
      orderBy: { date: "desc" },
    }),
    prisma.project.findMany({ where: projectWhereForUser(user), select: { id: true, title: true, status: true }, orderBy: { title: "asc" } }),
  ]);

  return { expenses, total: expenses.reduce((s, e) => s + e.amount, 0), projects };
}

// --- Reports ---

export type ReportRequest = {
  period: ReportPeriod;
  anchor?: string;
  from?: string;
  to?: string;
  locale: Locale;
};

const AGING_BUCKETS = ["current", "d1_30", "d31_60", "d60_plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

function agingBucketFor(dueDate: Date): AgingBucket {
  const d = overdueDays({ dueDate });
  if (d <= 0) return "current";
  if (d <= 30) return "d1_30";
  if (d <= 60) return "d31_60";
  return "d60_plus";
}

export type FinanceReport = {
  range: { from: Date; to: Date };
  isVatPayer: boolean;

  // Accrual (primary), all CZK.
  income: number; // Σ invoice subtotal → CZK (excl. VAT)
  expenseNet: number; // Σ (amount − deductible VAT)
  expenseGross: number; // Σ amount
  balance: number; // income − expenseNet
  margin: number; // %

  // Cash (secondary), all CZK.
  received: number; // Σ payments recorded in the period → CZK
  periodOutstanding: number; // still unpaid on invoices issued in the period
  overdue: number; // remaining on every overdue invoice (period-independent)

  byBucket: { label: string; income: number; expense: number }[];
  byProject: { id: string; number: string; title: string; income: number; expense: number }[];
  topCategories: [string, number][];

  currencyExposure: { currency: CurrencyCode; original: number; czk: number }[];
  mixedCurrency: boolean;

  vat: {
    outputByRate: { rate: number; base: number; vat: number }[];
    inputByRate: { rate: number; base: number; vat: number }[];
    outputTotal: number;
    inputTotal: number;
    net: number;
    revenueByRegime: { regime: VatRegime; base: number; count: number }[];
    ecSalesList: { name: string; dic: string; base: number; count: number }[];
  };

  receivablesAging: { bucket: AgingBucket; count: number; amount: number }[];
  outstandingInvoices: {
    id: string;
    number: string;
    company: string;
    dueDate: Date;
    overdueDays: number;
    remaining: number;
    remainingCzk: number;
    currency: CurrencyCode;
  }[];

  invoices: {
    id: string;
    number: string;
    issuedAt: Date;
    company: string;
    dic: string;
    regime: VatRegime;
    baseCzk: number;
    vatCzk: number;
    totalCzk: number;
    total: number;
    currency: CurrencyCode;
    status: string;
    paid: boolean;
  }[];
  expenses: {
    id: string;
    date: Date;
    category: string;
    projectLabel: string | null;
    note: string;
    gross: number;
    vatRate: number;
    vatAmount: number;
    net: number;
    hasReceipt: boolean;
  }[];
};

export async function getFinanceReport(user: SessionUser, req: ReportRequest): Promise<FinanceReport> {
  const invoiceWhere = invoiceWhereForUser(user);
  const expenseWhere = expenseWhereForUser(user);
  const { from, to } = resolveRange(req.period, req.anchor, req.from, req.to);

  const [invoicesRaw, expenses, payments, unpaidInvoices, settings] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...invoiceWhere, issuedAt: { gte: from, lt: to } },
      select: {
        id: true,
        number: true,
        total: true,
        subtotal: true,
        amountPaid: true,
        status: true,
        currency: true,
        issuedAt: true,
        items: { select: { quantity: true, unitPrice: true, vatRate: true } },
        project: { select: { id: true, number: true, title: true, companyName: true, companyDic: true } },
      },
    }),
    prisma.expense.findMany({
      where: { ...expenseWhere, date: { gte: from, lt: to } },
      select: {
        id: true,
        amount: true,
        vatRate: true,
        vatAmount: true,
        date: true,
        category: true,
        note: true,
        receiptPath: true,
        project: { select: { id: true, number: true, title: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.payment.findMany({
      where: { invoice: invoiceWhere, date: { gte: from, lt: to } },
      select: { amount: true, invoice: { select: { currency: true, issuedAt: true } } },
    }),
    prisma.invoice.findMany({
      where: { ...invoiceWhere, status: { not: "PAID" } },
      select: {
        id: true,
        number: true,
        total: true,
        amountPaid: true,
        dueDate: true,
        currency: true,
        issuedAt: true,
        project: { select: { companyName: true } },
      },
    }),
    getCompanySettings(),
  ]);

  // --- FX passes. EUR/USD amounts convert at the CNB fixing rate on the
  // document's own issue date (see fx.ts); expenses carry no currency, always CZK.
  const exclVat = await toCzkBatch(
    invoicesRaw.map((i) => ({
      amount: i.subtotal,
      currency: i.currency,
      date: i.issuedAt,
      inv: i,
    })),
  );
  const perRateFlat = invoicesRaw.flatMap((inv) => {
    const buckets = vatBucketsForInvoice(inv.items, inv.total);
    return [...buckets.entries()].map(([rate, v]) => ({ inv, rate, base: v.base, vat: v.vat }));
  });
  const [perRateBaseCzk, perRateVatCzk, receivedCzk, unpaidRemainingCzk] = await Promise.all([
    toCzkBatch(perRateFlat.map((f) => ({ amount: f.base, currency: f.inv.currency, date: f.inv.issuedAt, invId: f.inv.id, rate: f.rate }))),
    toCzkBatch(perRateFlat.map((f) => ({ amount: f.vat, currency: f.inv.currency, date: f.inv.issuedAt, invId: f.inv.id, rate: f.rate }))),
    toCzkBatch(payments.map((p) => ({ amount: p.amount, currency: p.invoice.currency, date: p.invoice.issuedAt }))),
    toCzkBatch(
      unpaidInvoices.map((i) => ({ amount: i.total - i.amountPaid, currency: i.currency, date: i.issuedAt, inv: i })),
    ),
  ]);

  const income = exclVat.reduce((s, i) => s + i.czkAmount, 0);
  const expenseGross = expenses.reduce((s, e) => s + e.amount, 0);
  const expenseNet = expenses.reduce((s, e) => s + (e.amount - e.vatAmount), 0);
  const balance = income - expenseNet;
  const margin = income > 0 ? Math.round((balance / income) * 100) : 0;
  const received = receivedCzk.reduce((s, p) => s + p.czkAmount, 0);

  const exclVatById = new Map(exclVat.map((r) => [r.inv.id, r.czkAmount]));
  const periodOutstanding = invoicesRaw
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => {
      const base = exclVatById.get(i.id) ?? 0;
      const frac = i.total > 0 ? (i.total - i.amountPaid) / i.total : 0;
      return s + Math.round(base * frac);
    }, 0);

  // --- chart buckets ---
  const buckets = reportBuckets(from, to, req.locale);
  const byBucket = buckets.map((b) => ({ label: b.label, income: 0, expense: 0 }));
  const bucketIdx = (d: Date) => {
    const i = buckets.findIndex((b) => d >= b.start && d < b.end);
    return i === -1 ? -1 : i;
  };
  for (const r of exclVat) {
    const i = bucketIdx(r.inv.issuedAt);
    if (i !== -1) byBucket[i].income += r.czkAmount;
  }
  for (const e of expenses) {
    const i = bucketIdx(e.date);
    if (i !== -1) byBucket[i].expense += e.amount - e.vatAmount;
  }

  // --- by project ---
  const byProject = new Map<string, { id: string; number: string; title: string; income: number; expense: number }>();
  const touchProject = (id: string, number: string, title: string) => {
    if (!byProject.has(id)) byProject.set(id, { id, number, title, income: 0, expense: 0 });
    return byProject.get(id)!;
  };
  for (const r of exclVat) touchProject(r.inv.project.id, r.inv.project.number, r.inv.project.title).income += r.czkAmount;
  for (const e of expenses) if (e.project) touchProject(e.project.id, e.project.number, e.project.title).expense += e.amount - e.vatAmount;

  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (e.amount - e.vatAmount));
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  // --- currency exposure ---
  const exposure = new Map<CurrencyCode, { original: number; czk: number }>();
  for (const r of exclVat) {
    const cur = r.inv.currency as CurrencyCode;
    const row = exposure.get(cur) ?? { original: 0, czk: 0 };
    row.original += r.inv.subtotal;
    row.czk += r.czkAmount;
    exposure.set(cur, row);
  }
  const currencyExposure = [...exposure.entries()].map(([currency, v]) => ({ currency, ...v })).sort((a, b) => b.czk - a.czk);

  // --- VAT ---
  const outputBase = new Map<number, number>();
  const outputVat = new Map<number, number>();
  const perInvBaseCzk = new Map<string, number>();
  const perInvVatCzk = new Map<string, number>();
  perRateFlat.forEach((f, idx) => {
    const b = perRateBaseCzk[idx].czkAmount;
    // A reverse-charge (EU) or export supply carries no Czech output VAT,
    // whatever rate the line item happens to hold — the base lands in the 0%
    // bucket. Domestic invoices keep their real per-line rate.
    const domestic = classifyRegime(f.inv.project.companyDic) === "domestic";
    const rate = domestic ? f.rate : 0;
    const v = domestic ? perRateVatCzk[idx].czkAmount : 0;
    outputBase.set(rate, (outputBase.get(rate) ?? 0) + b);
    outputVat.set(rate, (outputVat.get(rate) ?? 0) + v);
    perInvBaseCzk.set(f.inv.id, (perInvBaseCzk.get(f.inv.id) ?? 0) + b);
    perInvVatCzk.set(f.inv.id, (perInvVatCzk.get(f.inv.id) ?? 0) + v);
  });
  const outputByRate = [...outputBase.keys()]
    .sort((a, b) => b - a)
    .map((rate) => ({ rate, base: Math.round(outputBase.get(rate) ?? 0), vat: Math.round(outputVat.get(rate) ?? 0) }));

  const inputBase = new Map<number, number>();
  const inputVat = new Map<number, number>();
  for (const e of expenses) {
    if (e.vatAmount <= 0) continue;
    inputBase.set(e.vatRate, (inputBase.get(e.vatRate) ?? 0) + (e.amount - e.vatAmount));
    inputVat.set(e.vatRate, (inputVat.get(e.vatRate) ?? 0) + e.vatAmount);
  }
  const inputByRate = [...inputBase.keys()]
    .sort((a, b) => b - a)
    .map((rate) => ({ rate, base: inputBase.get(rate) ?? 0, vat: inputVat.get(rate) ?? 0 }));

  const outputTotal = outputByRate.reduce((s, r) => s + r.vat, 0);
  const inputTotal = inputByRate.reduce((s, r) => s + r.vat, 0);

  const regimeAgg = new Map<VatRegime, { base: number; count: number }>();
  const ecMap = new Map<string, { name: string; dic: string; base: number; count: number }>();
  for (const r of exclVat) {
    const regime = classifyRegime(r.inv.project.companyDic);
    const row = regimeAgg.get(regime) ?? { base: 0, count: 0 };
    row.base += r.czkAmount;
    row.count += 1;
    regimeAgg.set(regime, row);
    if (regime === "eu") {
      const dic = r.inv.project.companyDic.trim().toUpperCase();
      const ec = ecMap.get(dic) ?? { name: r.inv.project.companyName, dic, base: 0, count: 0 };
      ec.base += r.czkAmount;
      ec.count += 1;
      ecMap.set(dic, ec);
    }
  }
  const revenueByRegime = (["domestic", "eu", "export"] as const)
    .map((regime) => ({ regime, ...(regimeAgg.get(regime) ?? { base: 0, count: 0 }) }))
    .filter((r) => r.count > 0);
  const ecSalesList = [...ecMap.values()].sort((a, b) => b.base - a.base);

  // --- receivables aging (all currently-unpaid invoices) ---
  const remainingById = new Map(unpaidRemainingCzk.map((r) => [r.inv.id, r.czkAmount]));
  const agingAgg = new Map<AgingBucket, { count: number; amount: number }>();
  let overdue = 0;
  const outstandingInvoices = unpaidInvoices
    .map((i) => {
      const remainingCzk = remainingById.get(i.id) ?? 0;
      const bucket = agingBucketFor(i.dueDate);
      const agg = agingAgg.get(bucket) ?? { count: 0, amount: 0 };
      agg.count += 1;
      agg.amount += remainingCzk;
      agingAgg.set(bucket, agg);
      if (bucket !== "current") overdue += remainingCzk;
      return {
        id: i.id,
        number: i.number,
        company: i.project.companyName,
        dueDate: i.dueDate,
        overdueDays: overdueDays({ dueDate: i.dueDate }),
        remaining: i.total - i.amountPaid,
        remainingCzk,
        currency: i.currency as CurrencyCode,
      };
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);
  const receivablesAging = AGING_BUCKETS.map((bucket) => ({ bucket, ...(agingAgg.get(bucket) ?? { count: 0, amount: 0 }) }));

  // --- documents ---
  const invoices = invoicesRaw
    .map((i) => ({
      id: i.id,
      number: i.number,
      issuedAt: i.issuedAt,
      company: i.project.companyName,
      dic: i.project.companyDic,
      regime: classifyRegime(i.project.companyDic),
      baseCzk: Math.round(perInvBaseCzk.get(i.id) ?? exclVatById.get(i.id) ?? 0),
      vatCzk: Math.round(perInvVatCzk.get(i.id) ?? 0),
      totalCzk: Math.round((perInvBaseCzk.get(i.id) ?? 0) + (perInvVatCzk.get(i.id) ?? 0)),
      total: i.total,
      currency: i.currency as CurrencyCode,
      status: i.status,
      paid: i.status === "PAID",
    }))
    .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());

  const expenseRows = expenses.map((e) => ({
    id: e.id,
    date: e.date,
    category: e.category,
    projectLabel: e.project ? e.project.title : null,
    note: e.note,
    gross: e.amount,
    vatRate: e.vatRate,
    vatAmount: e.vatAmount,
    net: e.amount - e.vatAmount,
    hasReceipt: Boolean(e.receiptPath),
  }));

  return {
    range: { from, to },
    isVatPayer: settings?.isVatPayer ?? true,
    income,
    expenseNet,
    expenseGross,
    balance,
    margin,
    received,
    periodOutstanding,
    overdue,
    byBucket,
    byProject: [...byProject.values()].sort((a, b) => b.income + b.expense - (a.income + a.expense)),
    topCategories,
    currencyExposure,
    mixedCurrency: isMixedCurrencyTotal(invoicesRaw.map((i) => i.currency)),
    vat: {
      outputByRate,
      inputByRate,
      outputTotal,
      inputTotal,
      net: outputTotal - inputTotal,
      revenueByRegime,
      ecSalesList,
    },
    receivablesAging,
    outstandingInvoices,
    invoices,
    expenses: expenseRows,
  };
}

export async function getCompanySettings() {
  return prisma.companySettings.findUnique({ where: { id: "singleton" } });
}
