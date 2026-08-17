"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageFinance, canAddExpense, eventWhereForUser } from "@/lib/authz";
import { nextQuoteNumber, nextInvoiceNumber, variableSymbolFor } from "@/lib/document-number";
import { saveReceipt } from "@/lib/uploads";
import type { ExpenseCategory, QuoteStatus } from "@/generated/prisma/enums";

export type FinanceFormState = { error?: string; success?: boolean };

function parseItems(formData: FormData) {
  const descriptions = formData.getAll("itemDescription") as string[];
  const quantities = formData.getAll("itemQuantity") as string[];
  const unitPrices = formData.getAll("itemUnitPrice") as string[];
  const vatRates = formData.getAll("itemVatRate") as string[];

  const items: { description: string; quantity: number; unitPrice: number; vatRate: number }[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    if (!descriptions[i]?.trim()) continue;
    items.push({
      description: descriptions[i].trim(),
      quantity: Math.max(1, Number(quantities[i]) || 1),
      unitPrice: Math.max(0, Number(unitPrices[i]) || 0),
      vatRate: Number(vatRates[i] ?? 21) || 0,
    });
  }
  return items;
}

function itemsTotal(items: { quantity: number; unitPrice: number; vatRate: number }[]) {
  return Math.round(items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (1 + i.vatRate / 100), 0));
}

// --- Quotes ---

export async function createQuoteAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requireUser();
  if (!canManageFinance(user)) return { error: "You don't have permission to create quotes." };

  const eventId = String(formData.get("eventId") ?? "");
  const validUntil = String(formData.get("validUntil") ?? "");
  const status = (formData.get("status") as QuoteStatus) || "DRAFT";
  const items = parseItems(formData);

  if (!eventId || !validUntil || items.length === 0) {
    return { error: "Event, valid-until date and at least one line item are required." };
  }

  const number = await nextQuoteNumber();
  await prisma.quote.create({
    data: {
      eventId,
      number,
      status,
      validUntil: new Date(validUntil),
      total: itemsTotal(items),
      items: { create: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
    },
  });

  revalidatePath("/finance/quotes");
  revalidatePath(`/events/${eventId}`);
  redirect(`/finance/quotes`);
}

export async function updateQuoteAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requireUser();
  if (!canManageFinance(user)) return { error: "You don't have permission to edit quotes." };

  const id = String(formData.get("id"));
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing) return { error: "Quote not found." };
  if (existing.status !== "DRAFT") return { error: "Only draft quotes can be edited." };

  const validUntil = String(formData.get("validUntil") ?? "");
  const status = (formData.get("status") as QuoteStatus) || "DRAFT";
  const items = parseItems(formData);
  if (!validUntil || items.length === 0) return { error: "Valid-until date and at least one line item are required." };

  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
    prisma.quote.update({
      where: { id },
      data: {
        status,
        validUntil: new Date(validUntil),
        total: itemsTotal(items),
        items: { create: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
      },
    }),
  ]);

  revalidatePath("/finance/quotes");
  redirect("/finance/quotes");
}

export async function convertQuoteToInvoiceAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageFinance(user)) return;

  const quoteId = String(formData.get("quoteId"));
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true, invoices: true },
  });
  if (!quote || quote.status !== "ACCEPTED" || quote.invoices.length > 0) return;

  const company = await prisma.companySettings.findUnique({ where: { id: "singleton" } });
  const dueDays = company?.defaultDueDays ?? 14;

  const number = await nextInvoiceNumber();
  const dueDate = new Date(Date.now() + dueDays * 86400000);

  const invoice = await prisma.invoice.create({
    data: {
      eventId: quote.eventId,
      quoteId: quote.id,
      number,
      variableSymbol: variableSymbolFor(number),
      total: quote.total,
      dueDate,
      status: "ISSUED",
      items: {
        create: quote.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          sortOrder: i.sortOrder,
        })),
      },
      history: {
        create: [
          { type: "CREATED", message: `Created from quote ${quote.number}`, userId: user.id },
          { type: "ISSUED", message: `Issued and sent — ${user.name}`, userId: user.id },
        ],
      },
    },
  });

  revalidatePath("/finance/quotes");
  revalidatePath("/finance/invoices");
  revalidatePath(`/events/${quote.eventId}`);
  redirect(`/finance/invoices/${invoice.id}`);
}

// --- Invoices ---

export async function createInvoiceAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requireUser();
  if (!canManageFinance(user)) return { error: "You don't have permission to create invoices." };

  const eventId = String(formData.get("eventId") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const items = parseItems(formData);
  if (!eventId || !dueDate || items.length === 0) {
    return { error: "Event, due date and at least one line item are required." };
  }

  const number = await nextInvoiceNumber();
  const invoice = await prisma.invoice.create({
    data: {
      eventId,
      number,
      variableSymbol: variableSymbolFor(number),
      total: itemsTotal(items),
      dueDate: new Date(dueDate),
      status: "ISSUED",
      items: { create: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
      history: {
        create: [
          { type: "CREATED", message: "Invoice created", userId: user.id },
          { type: "ISSUED", message: `Issued and sent — ${user.name}`, userId: user.id },
        ],
      },
    },
  });

  revalidatePath("/finance/invoices");
  revalidatePath(`/events/${eventId}`);
  redirect(`/finance/invoices/${invoice.id}`);
}

export async function recordPaymentAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageFinance(user)) return;

  const invoiceId = String(formData.get("invoiceId"));
  const amount = Math.round(Number(formData.get("amount")) || 0);
  const note = String(formData.get("note") ?? "");
  if (amount <= 0) return;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return;

  const remaining = invoice.total - invoice.amountPaid;
  const applied = Math.min(amount, remaining);
  if (applied <= 0) return;

  const newAmountPaid = invoice.amountPaid + applied;
  const fullyPaid = newAmountPaid >= invoice.total;

  await prisma.$transaction([
    prisma.payment.create({ data: { invoiceId, amount: applied, note, recordedById: user.id } }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: fullyPaid ? "PAID" : "PARTLY_PAID",
        paidAt: fullyPaid ? new Date() : invoice.paidAt,
      },
    }),
    prisma.invoiceEvent.create({
      data: {
        invoiceId,
        type: fullyPaid ? "MARKED_PAID" : "PAYMENT_RECORDED",
        message: fullyPaid
          ? `Paid in full — ${user.name}`
          : `Partial payment recorded — ${user.name}`,
        userId: user.id,
      },
    }),
  ]);

  revalidatePath(`/finance/invoices/${invoiceId}`);
  revalidatePath("/finance/invoices");
}

export async function markInvoicePaidAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageFinance(user)) return;

  const invoiceId = String(formData.get("invoiceId"));
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === "PAID") return;

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: invoice.total, status: "PAID", paidAt: new Date() },
    }),
    prisma.invoiceEvent.create({
      data: { invoiceId, type: "MARKED_PAID", message: `Marked as paid — ${user.name}`, userId: user.id },
    }),
  ]);

  revalidatePath(`/finance/invoices/${invoiceId}`);
  revalidatePath("/finance/invoices");
}

// --- Expenses ---

export async function createExpenseAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requireUser();

  const eventIdRaw = String(formData.get("eventId") ?? "");
  const eventId = eventIdRaw === "overhead" || eventIdRaw === "" ? null : eventIdRaw;
  const amount = Math.round(Number(formData.get("amount")) || 0);
  const date = String(formData.get("date") ?? "");
  const category = formData.get("category") as ExpenseCategory;
  const note = String(formData.get("note") ?? "");
  const paidByRaw = String(formData.get("paidById") ?? "");

  if (amount <= 0 || !date || !category) {
    return { error: "Amount, date and category are required." };
  }

  let event: { ownerId: string; members: { userId: string }[] } | null = null;
  if (eventId) {
    event = await prisma.event.findFirst({
      where: { id: eventId, ...eventWhereForUser(user) },
      include: { members: { select: { userId: true } } },
    });
    if (!event) return { error: "Event not found or not accessible." };
  }
  if (!canAddExpense(user, event ? { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) } : null)) {
    return { error: "You don't have permission to add an expense here." };
  }

  // "Paid by": defaults to self. Non-card-holders can only submit as themselves;
  // card holders / Admin / Accountant / Producer may pick any card holder. See CLAUDE.md.
  let paidById = user.id;
  if (paidByRaw && paidByRaw !== user.id) {
    if (user.role === "MEMBER" && !user.isCardHolder) {
      return { error: "You can only log expenses paid by yourself." };
    }
    const target = await prisma.user.findUnique({ where: { id: paidByRaw } });
    if (!target?.isCardHolder) return { error: "Selected payer is not a company-card holder." };
    paidById = paidByRaw;
  }

  let receiptPath: string | null = null;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    try {
      receiptPath = await saveReceipt(receipt);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not save receipt." };
    }
  }

  await prisma.expense.create({
    data: { eventId, paidById, amount, date: new Date(date), category, note, receiptPath },
  });

  revalidatePath("/finance/expenses");
  revalidatePath("/dashboard");
  if (eventId) revalidatePath(`/events/${eventId}`);

  if (formData.get("again") === "1") return { success: true };
  redirect("/finance/expenses");
}
