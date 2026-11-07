import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz";
import { nextQuoteNumber, nextInvoiceNumber, variableSymbolFor } from "@/lib/document-number";
import { itemsTotal, itemsBase, applyDiscount } from "@/lib/finance-math";
import { syncQuotedValue } from "@/lib/quoted-value";
import { parseIsoDate } from "@/lib/calendar";
import { getInvoiceDetail, getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { buildInvoicePdfBuffer } from "@/lib/pdf/build-invoice-pdf";
import { buildQuotePdfBuffer } from "@/lib/pdf/build-quote-pdf";
import { sendEmail, renderEmailTemplate, EmailNotConfiguredError } from "@/lib/email";
import { DEFAULT_INVOICE_EMAIL_SUBJECT, DEFAULT_INVOICE_EMAIL_BODY } from "@/lib/email-templates";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Currency, DiscountType } from "@/generated/prisma/enums";
import type { PdfLang } from "@/lib/pdf/i18n";

/**
 * Write paths for the Claude connector. Each mirrors its web-form
 * counterpart in lib/actions/finance.ts (same numbering, totals and
 * quoted-value sync) but takes plain typed input instead of FormData and
 * returns errors as thrown AgentError messages instead of redirecting.
 * The rules that make this connector "restricted" live here, server-side:
 * quotes are always created as DRAFT, only Claude's own DRAFT quotes can be
 * edited, and email only goes to addresses already on file for the client.
 */

export class AgentError extends Error {}

export type LineItemInput = { description: string; quantity: number; unitPrice: number; vatRate: number; category?: string };

function normalizeItems(items: LineItemInput[]) {
  const clean = items
    .filter((i) => i.description.trim())
    .map((i, idx) => ({
      description: i.description.trim(),
      quantity: Math.max(1, Math.round(i.quantity)),
      unitPrice: Math.max(0, Math.round(i.unitPrice)),
      vatRate: Math.max(0, Math.round(i.vatRate)),
      category: (i.category ?? "").trim(),
      sortOrder: idx,
    }));
  if (clean.length === 0) throw new AgentError("At least one line item with a description is required.");
  return clean;
}

function parseDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AgentError(`${field} must be a YYYY-MM-DD date.`);
  return parseIsoDate(value);
}

async function requireProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, number: true } });
  if (!project) throw new AgentError("Project not found — look it up with list_projects first.");
  return project;
}

function revalidateFinance(projectId: string) {
  revalidatePath("/finance/quotes");
  revalidatePath("/finance/invoices");
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/clients");
}

// --- Quotes ---

export async function createQuoteDraft(
  user: SessionUser,
  input: { projectId: string; validUntil: string; currency: Currency; hideItemPrices: boolean; items: LineItemInput[] }
) {
  const project = await requireProject(input.projectId);
  const items = normalizeItems(input.items);
  const validUntil = parseDate(input.validUntil, "validUntil");

  const quote = await prisma.quote.create({
    data: {
      projectId: project.id,
      number: await nextQuoteNumber(project.id, project.number),
      status: "DRAFT",
      currency: input.currency,
      hideItemPrices: input.hideItemPrices,
      createdById: user.id,
      validUntil,
      total: itemsTotal(items),
      subtotal: itemsBase(items),
      items: { create: items },
    },
  });
  await syncQuotedValue(project.id);
  revalidateFinance(project.id);
  return quote.id;
}

export async function updateOwnQuoteDraft(
  user: SessionUser,
  input: { quoteId: string; validUntil?: string; currency?: Currency; hideItemPrices?: boolean; items?: LineItemInput[] }
) {
  const existing = await prisma.quote.findUnique({ where: { id: input.quoteId } });
  if (!existing) throw new AgentError("Quote not found.");
  if (existing.createdById !== user.id) throw new AgentError("Claude can only edit quotes it created itself.");
  if (existing.status !== "DRAFT") throw new AgentError("Only DRAFT quotes can be edited — this one has already been sent.");

  const items = input.items ? normalizeItems(input.items) : null;
  await prisma.$transaction([
    ...(items ? [prisma.quoteItem.deleteMany({ where: { quoteId: existing.id } })] : []),
    prisma.quote.update({
      where: { id: existing.id },
      data: {
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.hideItemPrices !== undefined ? { hideItemPrices: input.hideItemPrices } : {}),
        ...(input.validUntil ? { validUntil: parseDate(input.validUntil, "validUntil") } : {}),
        ...(items ? { total: itemsTotal(items), subtotal: itemsBase(items), items: { create: items } } : {}),
      },
    }),
  ]);
  await syncQuotedValue(existing.projectId);
  revalidatePath(`/finance/quotes/${existing.id}`);
  revalidateFinance(existing.projectId);
}

// --- Invoices ---

export type InvoiceInput = {
  projectId?: string;
  fromQuoteId?: string;
  dueDate?: string;
  currency?: Currency;
  hideItemPrices?: boolean;
  discountType?: DiscountType;
  discountValue?: number;
  items?: LineItemInput[];
};

/**
 * Resolves invoice input into exactly what would be written — shared by
 * preview_invoice (no write) and create_invoice, so the preview Simon
 * approves is byte-for-byte what gets issued. `fromQuoteId` copies an
 * ACCEPTED, not-yet-invoiced quote, like the web "Convert to invoice".
 */
export async function resolveInvoice(input: InvoiceInput) {
  const company = await getCompanySettings();
  let projectId = input.projectId;
  let items: ReturnType<typeof normalizeItems>;
  let currency = input.currency ?? "CZK";
  let hideItemPrices = input.hideItemPrices ?? true;
  let quote: { id: string; number: string } | null = null;

  if (input.fromQuoteId) {
    const q = await prisma.quote.findUnique({ where: { id: input.fromQuoteId }, include: { items: { orderBy: { sortOrder: "asc" } }, invoices: true } });
    if (!q) throw new AgentError("Quote not found.");
    if (q.status !== "ACCEPTED") throw new AgentError("Only an ACCEPTED quote can be turned into an invoice.");
    if (q.invoices.length > 0) throw new AgentError(`Quote ${q.number} has already been invoiced.`);
    if (projectId && projectId !== q.projectId) throw new AgentError("fromQuoteId belongs to a different project.");
    projectId = q.projectId;
    quote = { id: q.id, number: q.number };
    items = input.items ? normalizeItems(input.items) : normalizeItems(q.items);
    currency = input.currency ?? q.currency;
    hideItemPrices = input.hideItemPrices ?? q.hideItemPrices;
  } else {
    if (!input.items) throw new AgentError("Provide line items, or fromQuoteId to copy an accepted quote.");
    items = normalizeItems(input.items);
  }
  if (!projectId) throw new AgentError("projectId is required.");
  const project = await requireProject(projectId);

  const discountType = input.discountType ?? "NONE";
  const discountValue = Math.max(0, Math.round(input.discountValue ?? 0));
  const { total, subtotal, discountAmount } = applyDiscount(items, discountType, discountValue);
  const dueDate = input.dueDate
    ? parseDate(input.dueDate, "dueDate")
    : new Date(Date.now() + (company?.defaultDueDays ?? 14) * 86_400_000);
  const number = await nextInvoiceNumber(project.id, project.number);

  return { project, quote, items, currency, hideItemPrices, discountType, discountValue, discountAmount, total, subtotal, dueDate, number };
}

export async function createInvoice(user: SessionUser, input: InvoiceInput) {
  const r = await resolveInvoice(input);
  const invoice = await prisma.invoice.create({
    data: {
      projectId: r.project.id,
      quoteId: r.quote?.id,
      number: r.number,
      variableSymbol: variableSymbolFor(r.number),
      total: r.total,
      subtotal: r.subtotal,
      currency: r.currency,
      hideItemPrices: r.hideItemPrices,
      discountType: r.discountType,
      discountValue: r.discountValue,
      dueDate: r.dueDate,
      status: "ISSUED",
      items: { create: r.items },
      history: {
        create: [
          {
            type: "CREATED",
            message: r.quote ? `Created from quote ${r.quote.number} via Claude connector` : "Invoice created via Claude connector",
            userId: user.id,
          },
          {
            type: "ISSUED",
            message: r.discountAmount > 0 ? `Issued — ${user.name} (discount applied: ${r.discountAmount})` : `Issued — ${user.name}`,
            userId: user.id,
          },
        ],
      },
    },
  });
  await syncQuotedValue(r.project.id);
  revalidateFinance(r.project.id);
  return invoice.id;
}

// --- Email ---

type ProjectWithContacts = {
  client: { invoicingEmail: string; contacts?: { email: string }[] } | null;
  contacts: { email: string }[];
};

/** Every address already on file for this project's client — the only addresses Claude may send to. */
async function allowedRecipients(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { contacts: { select: { email: true }, orderBy: { sortOrder: "asc" } }, client: { select: { invoicingEmail: true, contacts: { select: { email: true } } } } },
  });
  if (!project) return { all: [] as string[], fallback: null as string | null };
  return recipientsFrom(project);
}

function recipientsFrom(project: ProjectWithContacts) {
  const ordered = [project.client?.invoicingEmail ?? "", ...project.contacts.map((c) => c.email), ...(project.client?.contacts ?? []).map((c) => c.email)]
    .map((e) => e.trim())
    .filter(Boolean);
  const all = [...new Set(ordered.map((e) => e.toLowerCase()))];
  // Same default the web "Send invoice" button uses: invoicing email, else first project contact.
  return { all, fallback: ordered[0] ?? null };
}

async function resolveRecipient(projectId: string, requested: string | undefined) {
  const { all, fallback } = await allowedRecipients(projectId);
  if (requested) {
    if (!all.includes(requested.trim().toLowerCase())) {
      throw new AgentError(
        `${requested} isn't on file for this client. Allowed: ${all.join(", ") || "none"}. Add the address to the client or project contacts in the app first.`
      );
    }
    return requested.trim();
  }
  if (!fallback) throw new AgentError("No email address on file for this client — add one to the project's contacts or the client's invoicing email.");
  return fallback;
}

function emailFailure(err: unknown): never {
  throw new AgentError(err instanceof EmailNotConfiguredError ? err.message : "Couldn't send the email — check the SMTP settings.");
}

export async function sendInvoice(user: SessionUser, input: { invoiceId: string; to?: string; message?: string; language?: PdfLang }) {
  const invoice = await getInvoiceDetail(user, input.invoiceId);
  if (!invoice) throw new AgentError("Invoice not found.");
  const to = await resolveRecipient(invoice.projectId, input.to);
  const company = await getCompanySettings();
  const lang: PdfLang = input.language ?? (company?.locale === "cs" ? "cs" : "en");

  const vars = {
    invoiceNumber: invoice.number,
    companyName: company?.name ?? "",
    clientName: invoice.project.companyName,
    projectTitle: invoice.project.title,
    amount: formatCurrency(invoice.total - invoice.amountPaid, invoice.currency),
    dueDate: formatDate(invoice.dueDate),
  };
  const subject = renderEmailTemplate(company?.invoiceEmailSubject ?? DEFAULT_INVOICE_EMAIL_SUBJECT, vars);
  const text = input.message?.trim() || renderEmailTemplate(company?.invoiceEmailBody ?? DEFAULT_INVOICE_EMAIL_BODY, vars);

  try {
    const pdf = await buildInvoicePdfBuffer(invoice, company, lang);
    await sendEmail({ to, subject, text, attachments: [{ filename: `invoice-${invoice.number}.pdf`, content: pdf, contentType: "application/pdf" }] });
  } catch (err) {
    emailFailure(err);
  }

  await prisma.$transaction([
    prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } }),
    prisma.invoiceEvent.create({
      data: { invoiceId: invoice.id, type: "EMAILED", message: `Emailed to ${to} — ${user.name} (Claude connector)`, userId: user.id },
    }),
  ]);
  revalidatePath(`/finance/invoices/${invoice.id}`);
  return { to, subject };
}

const QUOTE_EMAIL = {
  en: {
    subject: (n: string, company: string) => `Quote ${n} from ${company}`,
    body: (client: string, n: string, project: string, until: string, company: string) =>
      `Hi ${client},\n\nPlease find attached our quote ${n} for ${project}, valid until ${until}.\n\nLooking forward to hearing from you,\n${company}`,
  },
  cs: {
    subject: (n: string, company: string) => `Cenová nabídka ${n} – ${company}`,
    body: (client: string, n: string, project: string, until: string, company: string) =>
      `Dobrý den,\n\nv příloze zasíláme cenovou nabídku ${n} na ${project} pro ${client}, platnou do ${until}.\n\nS pozdravem,\n${company}`,
  },
};

/** Emails a quote and moves a DRAFT to SENT (the same transition the web form's status field makes). */
export async function sendQuote(user: SessionUser, input: { quoteId: string; to?: string; message?: string; language?: PdfLang }) {
  const quote = await getQuoteDetail(user, input.quoteId);
  if (!quote) throw new AgentError("Quote not found.");
  if (quote.status !== "DRAFT" && quote.status !== "SENT") throw new AgentError(`Quote is already ${quote.status} — nothing to send.`);
  const to = await resolveRecipient(quote.projectId, input.to);
  const company = await getCompanySettings();
  const lang: PdfLang = input.language ?? (company?.locale === "cs" ? "cs" : "en");
  const tpl = QUOTE_EMAIL[lang];
  const companyName = company?.name ?? "";
  const subject = tpl.subject(quote.number, companyName);
  const until = quote.validUntil.toLocaleDateString(lang === "cs" ? "cs-CZ" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const text = input.message?.trim() || tpl.body(quote.project.companyName, quote.number, quote.project.title, until, companyName);

  try {
    const pdf = await buildQuotePdfBuffer(quote, company, lang);
    await sendEmail({ to, subject, text, attachments: [{ filename: `quote-${quote.number}.pdf`, content: pdf, contentType: "application/pdf" }] });
  } catch (err) {
    emailFailure(err);
  }

  if (quote.status === "DRAFT") {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "SENT" } });
    await syncQuotedValue(quote.projectId);
  }
  revalidatePath(`/finance/quotes/${quote.id}`);
  revalidateFinance(quote.projectId);
  return { to, subject };
}
