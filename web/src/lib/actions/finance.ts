"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageFinance, canAddExpense, canPickOtherPayer, canEditExpense, eventWhereForUser, isAdmin } from "@/lib/authz";
import { nextQuoteNumber, nextInvoiceNumber, variableSymbolFor } from "@/lib/document-number";
import { saveReceipt, deleteReceipt } from "@/lib/uploads";
import type { ExpenseCategory, QuoteStatus, Currency, DiscountType } from "@/generated/prisma/enums";

export type FinanceFormState = { error?: string; success?: boolean };

function parseItems(formData: FormData) {
  const descriptions = formData.getAll("itemDescription") as string[];
  const quantities = formData.getAll("itemQuantity") as string[];
  const unitPrices = formData.getAll("itemUnitPrice") as string[];
  const vatRates = formData.getAll("itemVatRate") as string[];
  const categories = formData.getAll("itemCategory") as string[];

  const items: { description: string; quantity: number; unitPrice: number; vatRate: number; category: string }[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    if (!descriptions[i]?.trim()) continue;
    items.push({
      description: descriptions[i].trim(),
      quantity: Math.max(1, Number(quantities[i]) || 1),
      unitPrice: Math.max(0, Number(unitPrices[i]) || 0),
      vatRate: Number(vatRates[i] ?? 21) || 0,
      category: (categories[i] ?? "").trim(),
    });
  }
  return items;
}

function itemsTotal(items: { quantity: number; unitPrice: number; vatRate: number }[]) {
  return Math.round(items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (1 + i.vatRate / 100), 0));
}

/**
 * Discount is applied to the pre-VAT base, then VAT is recomputed on the
 * discounted base — not a flat cut off the final total. That's both the
 * legally correct way to handle a discounted invoice (VAT is owed on what
 * was actually charged) and the more common real-world behavior.
 */
function applyDiscount(
  items: { quantity: number; unitPrice: number; vatRate: number }[],
  discountType: DiscountType,
  discountValue: number
) {
  const base = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  if (discountType === "NONE" || discountValue <= 0) {
    return { total: Math.round(base + vat), discountAmount: 0 };
  }
  const avgVatRate = base > 0 ? vat / base : 0;
  const discountAmount =
    discountType === "PERCENT" ? Math.round(base * (Math.min(100, discountValue) / 100)) : Math.min(base, discountValue);
  const discountedBase = base - discountAmount;
  const discountedVat = discountedBase * avgVatRate;
  return { total: Math.round(discountedBase + discountedVat), discountAmount };
}

// --- Quotes ---

export async function createQuoteAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requireUser();
  if (!canManageFinance(user)) return { error: "You don't have permission to create quotes." };

  const eventId = String(formData.get("eventId") ?? "");
  const validUntil = String(formData.get("validUntil") ?? "");
  const status = (formData.get("status") as QuoteStatus) || "DRAFT";
  const currency = (formData.get("currency") as Currency) || "CZK";
  const hideItemPrices = formData.get("hideItemPrices") === "on";
  const items = parseItems(formData);

  if (!eventId || !validUntil || items.length === 0) {
    return { error: "Event, valid-until date and at least one line item are required." };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { number: true } });
  if (!event) return { error: "Event not found." };

  const number = await nextQuoteNumber(eventId, event.number);
  const quote = await prisma.quote.create({
    data: {
      eventId,
      number,
      status,
      currency,
      hideItemPrices,
      createdById: user.id,
      validUntil: new Date(validUntil),
      total: itemsTotal(items),
      items: { create: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
    },
  });

  revalidatePath("/finance/quotes");
  revalidatePath(`/events/${eventId}`);
  redirect(`/finance/quotes/${quote.id}`);
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
  const currency = (formData.get("currency") as Currency) || "CZK";
  const hideItemPrices = formData.get("hideItemPrices") === "on";
  const items = parseItems(formData);
  if (!validUntil || items.length === 0) return { error: "Valid-until date and at least one line item are required." };

  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
    prisma.quote.update({
      where: { id },
      data: {
        status,
        currency,
        hideItemPrices,
        validUntil: new Date(validUntil),
        total: itemsTotal(items),
        items: { create: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
      },
    }),
  ]);

  revalidatePath("/finance/quotes");
  redirect(`/finance/quotes/${id}`);
}

/**
 * Moves a sent quote to Accepted or Declined — the client's actual verdict,
 * not something the original draft/edit form covers (that only sets status
 * up front, at DRAFT/SENT time). Scoped to quotes currently SENT, since
 * that's the only state this was missing a UI for; DRAFT keeps going
 * through Edit, and ACCEPTED converts to an invoice. DECLINED's own next
 * step is duplicateQuoteAction below, not a further status change.
 */
export async function updateQuoteStatusAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageFinance(user)) return;

  const id = String(formData.get("id"));
  const status = formData.get("status") as QuoteStatus;
  if (status !== "ACCEPTED" && status !== "DECLINED") return;

  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote || quote.status !== "SENT") return;

  await prisma.quote.update({ where: { id }, data: { status } });

  revalidatePath(`/finance/quotes/${id}`);
  revalidatePath("/finance/quotes");
}

/**
 * "Create new" for a declined quote — copies the event, items, currency and
 * hide-item-prices setting into a fresh DRAFT quote (own new YY-XXX_v# number,
 * own new creator/issuedAt) and sends the user straight to its edit page, so
 * a rejected quote can be revised and resent without retyping every line
 * item from scratch. validUntil is reset to two weeks out rather than
 * copying the old (likely already-expired) date.
 */
export async function duplicateQuoteAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageFinance(user)) return;

  const id = String(formData.get("id"));
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: true, event: { select: { number: true } } },
  });
  if (!quote || quote.status !== "DECLINED") return;

  const number = await nextQuoteNumber(quote.eventId, quote.event.number);
  const duplicate = await prisma.quote.create({
    data: {
      eventId: quote.eventId,
      number,
      status: "DRAFT",
      currency: quote.currency,
      hideItemPrices: quote.hideItemPrices,
      createdById: user.id,
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      total: quote.total,
      items: {
        create: quote.items.map((i, idx) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          category: i.category,
          sortOrder: idx,
        })),
      },
    },
  });

  revalidatePath("/finance/quotes");
  revalidatePath(`/events/${quote.eventId}`);
  redirect(`/finance/quotes/${duplicate.id}/edit`);
}

/** Admin-only, irreversible. If already converted, the invoice stays — only its quoteId link is cleared (schema's ON DELETE SET NULL). */
export async function deleteQuoteAction(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) return;

  const id = String(formData.get("id"));
  const quote = await prisma.quote.findUnique({ where: { id }, select: { eventId: true } });
  if (!quote) return;

  await prisma.quote.delete({ where: { id } });

  revalidatePath("/finance/quotes");
  revalidatePath(`/events/${quote.eventId}`);
  redirect("/finance/quotes");
}

export async function convertQuoteToInvoiceAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageFinance(user)) return;

  const quoteId = String(formData.get("quoteId"));
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true, invoices: true, event: { select: { number: true } } },
  });
  if (!quote || quote.status !== "ACCEPTED" || quote.invoices.length > 0) return;

  const company = await prisma.companySettings.findUnique({ where: { id: "singleton" } });
  const dueDays = company?.defaultDueDays ?? 14;

  const number = await nextInvoiceNumber(quote.eventId, quote.event.number);
  const dueDate = new Date(Date.now() + dueDays * 86400000);

  const invoice = await prisma.invoice.create({
    data: {
      eventId: quote.eventId,
      quoteId: quote.id,
      number,
      variableSymbol: variableSymbolFor(number),
      total: quote.total,
      currency: quote.currency,
      hideItemPrices: quote.hideItemPrices,
      dueDate,
      status: "ISSUED",
      items: {
        create: quote.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          category: i.category,
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
  const currency = (formData.get("currency") as Currency) || "CZK";
  const hideItemPrices = formData.get("hideItemPrices") === "on";
  const discountType = (formData.get("discountType") as DiscountType) || "NONE";
  const discountValue = Math.max(0, Number(formData.get("discountValue")) || 0);
  const items = parseItems(formData);
  if (!eventId || !dueDate || items.length === 0) {
    return { error: "Event, due date and at least one line item are required." };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { number: true } });
  if (!event) return { error: "Event not found." };

  const { total, discountAmount } = applyDiscount(items, discountType, discountValue);
  const number = await nextInvoiceNumber(eventId, event.number);
  const invoice = await prisma.invoice.create({
    data: {
      eventId,
      number,
      variableSymbol: variableSymbolFor(number),
      total,
      currency,
      hideItemPrices,
      discountType,
      discountValue,
      dueDate: new Date(dueDate),
      status: "ISSUED",
      items: { create: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
      history: {
        create: [
          { type: "CREATED", message: "Invoice created", userId: user.id },
          {
            type: "ISSUED",
            message:
              discountAmount > 0
                ? `Issued and sent — ${user.name} (discount applied: ${discountAmount})`
                : `Issued and sent — ${user.name}`,
            userId: user.id,
          },
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

/**
 * Undoes "Mark as paid". Recomputes amountPaid from the sum of actually
 * recorded Payment rows (not the total value markInvoicePaidAction stuffs
 * in), so a real payment recorded independently is never lost — only the
 * artificial "mark as fully paid" bookkeeping gets undone. Status/paidAt
 * are re-derived from that recomputed amount, same rule used everywhere
 * else (>= total → PAID, > 0 → PARTLY_PAID, 0 → ISSUED).
 */
export async function revertInvoicePaidAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageFinance(user)) return;

  const invoiceId = String(formData.get("invoiceId"));
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice || invoice.status !== "PAID") return;

  const realAmountPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  // Nothing to undo — this invoice is genuinely, fully paid by real recorded
  // Payment rows, not the "mark as paid" shortcut's fabricated amount. The UI
  // already hides this button for that case (see InvoiceDetailPage), but a
  // spoofed/stale POST should still no-op rather than log a misleading
  // "undid" history entry for an action that changed nothing.
  if (realAmountPaid >= invoice.total) return;
  const status = realAmountPaid > 0 ? "PARTLY_PAID" : "ISSUED";

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: realAmountPaid, status, paidAt: null },
    }),
    prisma.invoiceEvent.create({
      data: { invoiceId, type: "PAID_REVERTED", message: `Undid "mark as paid" — ${user.name}`, userId: user.id },
    }),
  ]);

  revalidatePath(`/finance/invoices/${invoiceId}`);
  revalidatePath("/finance/invoices");
}

/** Admin-only, irreversible: cascades payments and history along with the invoice. */
export async function deleteInvoiceAction(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) return;

  const id = String(formData.get("id"));
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { eventId: true } });
  if (!invoice) return;

  await prisma.invoice.delete({ where: { id } });

  revalidatePath("/finance/invoices");
  revalidatePath(`/events/${invoice.eventId}`);
  redirect("/finance/invoices");
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
    if (!canPickOtherPayer(user)) {
      return { error: "You can only log expenses paid by yourself." };
    }
    const target = await prisma.user.findUnique({ where: { id: paidByRaw } });
    if (!target?.isCardHolder || !target.active) return { error: "Selected payer is not an active company-card holder." };
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

export async function updateExpenseAction(_prev: FinanceFormState, formData: FormData): Promise<FinanceFormState> {
  const user = await requireUser();

  const id = String(formData.get("id"));
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return { error: "Expense not found." };
  if (!canEditExpense(user, existing.paidById)) {
    return { error: "You don't have permission to edit this expense." };
  }

  const eventIdRaw = String(formData.get("eventId") ?? "");
  const eventId = eventIdRaw === "overhead" || eventIdRaw === "" ? null : eventIdRaw;
  const amount = Math.round(Number(formData.get("amount")) || 0);
  const date = String(formData.get("date") ?? "");
  const category = formData.get("category") as ExpenseCategory;
  const note = String(formData.get("note") ?? "");
  const paidByRaw = String(formData.get("paidById") ?? "");
  const removeReceipt = formData.get("removeReceipt") === "on";

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
    return { error: "You don't have permission to log an expense on that event." };
  }

  let paidById = existing.paidById;
  if (paidByRaw && paidByRaw !== existing.paidById) {
    if (!canPickOtherPayer(user)) {
      return { error: "You can only log expenses paid by yourself." };
    }
    const target = await prisma.user.findUnique({ where: { id: paidByRaw } });
    if (!target?.isCardHolder || !target.active) return { error: "Selected payer is not an active company-card holder." };
    paidById = paidByRaw;
  }

  let receiptPath = existing.receiptPath;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    try {
      const newPath = await saveReceipt(receipt);
      if (existing.receiptPath) await deleteReceipt(existing.receiptPath);
      receiptPath = newPath;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not save receipt." };
    }
  } else if (removeReceipt && existing.receiptPath) {
    await deleteReceipt(existing.receiptPath);
    receiptPath = null;
  }

  await prisma.expense.update({
    where: { id },
    data: { eventId, paidById, amount, date: new Date(date), category, note, receiptPath },
  });

  revalidatePath("/finance/expenses");
  revalidatePath("/dashboard");
  if (eventId) revalidatePath(`/events/${eventId}`);
  if (existing.eventId && existing.eventId !== eventId) revalidatePath(`/events/${existing.eventId}`);

  redirect("/finance/expenses");
}

/** Admin-only, irreversible. Also removes the receipt file from disk, if any. */
export async function deleteExpenseAction(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user)) return;

  const id = String(formData.get("id"));
  const expense = await prisma.expense.findUnique({ where: { id }, select: { eventId: true, receiptPath: true } });
  if (!expense) return;

  await prisma.expense.delete({ where: { id } });
  if (expense.receiptPath) await deleteReceipt(expense.receiptPath);

  revalidatePath("/finance/expenses");
  revalidatePath("/dashboard");
  if (expense.eventId) revalidatePath(`/events/${expense.eventId}`);
}
