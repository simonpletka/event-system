import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/authz";
import { getProjectList, getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { getClientList, getClientDetail } from "@/lib/queries/clients";
import { getQuoteList, getQuoteDetail, getInvoiceList, getInvoiceDetail, getInvoiceKpis, getCompanySettings, isOverdue } from "@/lib/queries/finance";
import { getItemCategories } from "@/lib/actions/categories";
import { projectHref, clientHref } from "@/lib/slug";
import { isoDate } from "@/lib/calendar";
import {
  AgentError,
  createQuoteDraft,
  updateOwnQuoteDraft,
  resolveInvoice,
  createInvoice,
  sendInvoice,
  sendQuote,
} from "@/lib/agent/documents";

/**
 * The complete, fixed list of what the Claude connector can do. There is
 * deliberately no generic "update"/"delete" tool: anything not registered
 * here simply doesn't exist for the agent, whatever its role says.
 */

const CURRENCY = z.enum(["CZK", "EUR", "USD"]);
const LANGUAGE = z.enum(["en", "cs"]).describe("Language of the PDF and default email text. Defaults to the company language.");
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD");

const LINE_ITEM = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0).describe("Price per unit excluding VAT, in whole units of the document currency (15000 = 15 000 Kč)."),
  vatRate: z.number().int().min(0).max(100).default(21).describe("VAT % — 21, 12 or 0. Use 0 for EU reverse-charge / export customers."),
  category: z.string().optional().describe("Optional heading the item is grouped under (see get_company_defaults for the usual list)."),
});

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** Turns an AgentError (a rule the agent hit) into a readable tool error instead of a protocol failure. */
function run<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return ok(await fn(args));
    } catch (err) {
      if (err instanceof AgentError) return { content: [{ type: "text", text: err.message }], isError: true };
      throw err;
    }
  };
}

const d = (date: Date | null | undefined) => (date ? isoDate(date) : null);

export function registerAgentTools(server: McpServer, user: SessionUser, baseUrl: string) {
  const link = (path: string) => `${baseUrl}${path}`;

  async function quoteView(id: string) {
    const q = await getQuoteDetail(user, id);
    if (!q) throw new AgentError("Quote not found.");
    return {
      id: q.id,
      number: q.number,
      status: q.status,
      currency: q.currency,
      subtotalExclVat: q.subtotal,
      totalInclVat: q.total,
      validUntil: d(q.validUntil),
      issuedAt: d(q.issuedAt),
      hideItemPrices: q.hideItemPrices,
      createdBy: q.createdBy.name,
      editableByClaude: q.createdById === user.id && q.status === "DRAFT",
      project: { id: q.project.id, number: q.project.number, title: q.project.title, client: q.project.companyName },
      items: q.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, category: i.category })),
      invoicedAs: q.invoices.map((i) => ({ id: i.id, number: i.number })),
      appLink: link(`/finance/quotes/${q.id}`),
      pdfLink: link(`/api/quotes/${q.id}/pdf`),
    };
  }

  async function invoiceView(id: string) {
    const inv = await getInvoiceDetail(user, id);
    if (!inv) throw new AgentError("Invoice not found.");
    return {
      id: inv.id,
      number: inv.number,
      variableSymbol: inv.variableSymbol,
      status: isOverdue(inv) ? `${inv.status} (OVERDUE)` : inv.status,
      currency: inv.currency,
      subtotalExclVat: inv.subtotal,
      totalInclVat: inv.total,
      amountPaid: inv.amountPaid,
      outstanding: inv.total - inv.amountPaid,
      discount: inv.discountType === "NONE" ? null : { type: inv.discountType, value: inv.discountValue },
      issuedAt: d(inv.issuedAt),
      dueDate: d(inv.dueDate),
      paidAt: d(inv.paidAt),
      lastEmailedAt: d(inv.sentAt),
      fromQuote: inv.quote ? { id: inv.quote.id, number: inv.quote.number } : null,
      project: { id: inv.project.id, number: inv.project.number, title: inv.project.title, client: inv.project.companyName },
      items: inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, category: i.category })),
      payments: inv.payments.map((p) => ({ amount: p.amount, date: d(p.date), note: p.note })),
      history: inv.history.map((h) => ({ at: h.createdAt.toISOString(), type: h.type, message: h.message })),
      appLink: link(`/finance/invoices/${inv.id}`),
      pdfLink: link(`/api/invoices/${inv.id}/pdf`),
    };
  }

  // --- Read ---

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "Search projects (events). By default only active ones; pass status \"ANY\" to include closed/cancelled.",
      inputSchema: {
        query: z.string().optional().describe("Matches title, client name, project number or contact name."),
        status: z.string().optional().describe("\"ACTIVE\" (default), \"ANY\", or a specific status like INQUIRY, CONFIRMED, CLOSED."),
        limit: z.number().int().min(1).max(100).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    run(async ({ query, status, limit }: { query?: string; status?: string; limit: number }) => {
      const { projects } = await getProjectList(user, { q: query, status });
      return projects.slice(0, limit).map((p) => ({
        id: p.id,
        number: p.number,
        title: p.title,
        client: p.companyName,
        status: p.status,
        start: d(p.startDate),
        end: d(p.endDate),
        quotedValueExclVatCzk: p.quotedValue,
        venues: p.venues.map((v) => v.name),
      }));
    })
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Full project detail: client company data, contacts (with emails), quotes and invoices. Accepts the internal id or the YY-XXX number.",
      inputSchema: { project: z.string().describe("Project id or number, e.g. \"26-014\".") },
      annotations: { readOnlyHint: true },
    },
    run(async ({ project }: { project: string }) => {
      const id = /^\d{2}-\d{3}$/.test(project) ? await resolveProjectIdByNumber(project) : project;
      const p = id ? await getProjectDetail(user, id) : null;
      if (!p) throw new AgentError("Project not found.");
      const client = p.clientId ? await prisma.client.findUnique({ where: { id: p.clientId }, select: { id: true, name: true, invoicingEmail: true } }) : null;
      return {
        id: p.id,
        number: p.number,
        title: p.title,
        status: p.status,
        start: d(p.startDate),
        end: d(p.endDate),
        owner: p.owner?.name ?? null,
        team: p.members.map((m) => m.user.name),
        company: { name: p.companyName, address: p.companyAddress, ico: p.companyIco, dic: p.companyDic },
        client,
        contacts: p.contacts.map((c) => ({ name: c.name, email: c.email, phone: c.phone })),
        venues: p.venues.map((v) => v.name),
        quotedValueExclVatCzk: p.quotedValue,
        quotes: p.quotes.map((q) => ({ id: q.id, number: q.number, status: q.status, currency: q.currency, subtotalExclVat: q.subtotal, totalInclVat: q.total })),
        invoices: p.invoices.map((i) => ({
          id: i.id,
          number: i.number,
          status: isOverdue(i) ? `${i.status} (OVERDUE)` : i.status,
          currency: i.currency,
          totalInclVat: i.total,
          amountPaid: i.amountPaid,
          dueDate: d(i.dueDate),
        })),
        appLink: link(projectHref(p)),
      };
    })
  );

  server.registerTool(
    "list_clients",
    {
      title: "List clients",
      description: "Clients with their total invoiced amount (excl. VAT, in CZK).",
      inputSchema: { query: z.string().optional().describe("Matches client name.") },
      annotations: { readOnlyHint: true },
    },
    run(async ({ query }: { query?: string }) => {
      const clients = await getClientList(user, query);
      return clients.map((c) => ({ id: c.id, name: c.name, ico: c.ico, projects: c.projectCount, totalChargedExclVatCzk: c.totalCharged }));
    })
  );

  server.registerTool(
    "get_client",
    {
      title: "Get client",
      description: "Client detail: address, IČO/DIČ, invoicing email, contacts and projects.",
      inputSchema: { clientId: z.string() },
      annotations: { readOnlyHint: true },
    },
    run(async ({ clientId }: { clientId: string }) => {
      const c = await getClientDetail(user, clientId);
      if (!c) throw new AgentError("Client not found.");
      return {
        id: c.id,
        name: c.name,
        address: [c.street, c.postCode, c.city, c.state].filter(Boolean).join(", "),
        ico: c.ico,
        dic: c.dic,
        invoicingEmail: c.invoicingEmail,
        note: c.note,
        contacts: c.contacts.map((x) => ({ name: x.name, role: x.role, email: x.email, phone: x.phone })),
        projects: c.projects.map((p) => ({ id: p.id, number: p.number, title: p.title, status: p.status, start: d(p.startDate) })),
        totalChargedExclVatCzk: c.totalCharged,
        appLink: link(clientHref(c)),
      };
    })
  );

  server.registerTool(
    "list_quotes",
    {
      title: "List quotes",
      description: "Quotes issued in a given year (default: this year), optionally filtered.",
      inputSchema: {
        status: z.enum(["DRAFT", "SENT", "ACCEPTED", "DECLINED"]).optional(),
        projectId: z.string().optional(),
        query: z.string().optional().describe("Matches quote number, project title or client name."),
        year: z.number().int().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    run(async (args: { status?: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED"; projectId?: string; query?: string; year?: number }) => {
      const { quotes, openValue } = await getQuoteList(user, { status: args.status, projectId: args.projectId, q: args.query, year: args.year });
      return {
        openPipelineExclVatCzk: openValue,
        quotes: quotes.map((q) => ({
          id: q.id,
          number: q.number,
          status: q.status,
          project: q.project.title,
          client: q.project.companyName,
          currency: q.currency,
          subtotalExclVat: q.subtotal,
          totalInclVat: q.total,
          issuedAt: d(q.issuedAt),
          validUntil: d(q.validUntil),
          invoiced: q.invoices.length > 0,
        })),
      };
    })
  );

  server.registerTool(
    "get_quote",
    {
      title: "Get quote",
      description: "Full quote with line items, plus links to view it in the app and as PDF.",
      inputSchema: { quoteId: z.string() },
      annotations: { readOnlyHint: true },
    },
    run(async ({ quoteId }: { quoteId: string }) => quoteView(quoteId))
  );

  server.registerTool(
    "list_invoices",
    {
      title: "List invoices",
      description: "Invoices, optionally filtered by payment bucket or project.",
      inputSchema: {
        bucket: z.enum(["issued", "partly_paid", "paid", "overdue"]).optional(),
        projectId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    run(async (args: { bucket?: "issued" | "partly_paid" | "paid" | "overdue"; projectId?: string }) => {
      const { invoices } = await getInvoiceList(user, args);
      return invoices.map((i) => ({
        id: i.id,
        number: i.number,
        status: isOverdue(i) ? `${i.status} (OVERDUE)` : i.status,
        project: i.project.title,
        client: i.project.companyName,
        currency: i.currency,
        totalInclVat: i.total,
        outstanding: i.total - i.amountPaid,
        issuedAt: d(i.issuedAt),
        dueDate: d(i.dueDate),
      }));
    })
  );

  server.registerTool(
    "get_invoice",
    {
      title: "Get invoice",
      description: "Full invoice with line items, payments and history, plus app/PDF links.",
      inputSchema: { invoiceId: z.string() },
      annotations: { readOnlyHint: true },
    },
    run(async ({ invoiceId }: { invoiceId: string }) => invoiceView(invoiceId))
  );

  server.registerTool(
    "get_finance_summary",
    {
      title: "Finance summary",
      description: "Receivables snapshot (all CZK, foreign currency converted at the CNB rate): unpaid, overdue, due in 7 days, paid this month, open quote pipeline.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    run(async () => {
      const [kpis, { openValue }] = await Promise.all([getInvoiceKpis(user), getQuoteList(user, {})]);
      return {
        unpaidInvoices: kpis.issuedUnpaid,
        overdue: kpis.overdue,
        dueWithin7Days: kpis.dueSoon,
        paidThisMonth: kpis.paidThisMonth,
        openQuotePipelineExclVatCzk: openValue,
        note: "Unpaid/overdue/due amounts are outstanding cash incl. VAT; pipeline is excl. VAT.",
      };
    })
  );

  server.registerTool(
    "get_company_defaults",
    {
      title: "Company defaults",
      description: "Defaults to use when drafting documents: payment terms, VAT-payer status, language and the usual line-item categories.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    run(async () => {
      const [company, categories] = await Promise.all([getCompanySettings(), getItemCategories()]);
      return {
        companyName: company?.name ?? null,
        isVatPayer: company?.isVatPayer ?? true,
        defaultDueDays: company?.defaultDueDays ?? 14,
        language: company?.locale ?? "en",
        vatRates: [21, 12, 0],
        itemCategories: categories.map((c) => c.name),
        today: isoDate(new Date()),
      };
    })
  );

  // --- Write ---

  server.registerTool(
    "create_quote",
    {
      title: "Create quote (draft)",
      description:
        "Creates a DRAFT quote for a project. Nothing is sent. Show the user the result (items, totals, appLink) and only send it after they explicitly confirm.",
      inputSchema: {
        projectId: z.string(),
        validUntil: DATE.describe("Last day the quote is valid, YYYY-MM-DD (typically ~14 days out)."),
        currency: CURRENCY.default("CZK"),
        hideItemPrices: z.boolean().default(true).describe("true = PDF shows category subtotals only, not per-item prices."),
        items: z.array(LINE_ITEM).min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    run(async (args: { projectId: string; validUntil: string; currency: "CZK" | "EUR" | "USD"; hideItemPrices: boolean; items: z.infer<typeof LINE_ITEM>[] }) =>
      quoteView(await createQuoteDraft(user, args))
    )
  );

  server.registerTool(
    "update_quote_draft",
    {
      title: "Edit own draft quote",
      description: "Edits a DRAFT quote that Claude itself created. Omitted fields stay as they are; `items`, when given, replaces the whole item list.",
      inputSchema: {
        quoteId: z.string(),
        validUntil: DATE.optional(),
        currency: CURRENCY.optional(),
        hideItemPrices: z.boolean().optional(),
        items: z.array(LINE_ITEM).min(1).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    run(async (args: { quoteId: string; validUntil?: string; currency?: "CZK" | "EUR" | "USD"; hideItemPrices?: boolean; items?: z.infer<typeof LINE_ITEM>[] }) => {
      await updateOwnQuoteDraft(user, args);
      return quoteView(args.quoteId);
    })
  );

  const invoiceInput = {
    projectId: z.string().optional().describe("Required unless fromQuoteId is given."),
    fromQuoteId: z.string().optional().describe("Copy an ACCEPTED, not-yet-invoiced quote (its items, currency and price display)."),
    dueDate: DATE.optional().describe("Defaults to today + the company's payment terms."),
    currency: CURRENCY.optional(),
    hideItemPrices: z.boolean().optional(),
    discountType: z.enum(["NONE", "PERCENT", "FIXED"]).optional(),
    discountValue: z.number().min(0).optional().describe("Percent (0–100) for PERCENT, whole currency units for FIXED. Applied before VAT."),
    items: z.array(LINE_ITEM).min(1).optional().describe("Required unless fromQuoteId is given; overrides the quote's items when both are given."),
  };
  type InvoiceArgs = {
    projectId?: string;
    fromQuoteId?: string;
    dueDate?: string;
    currency?: "CZK" | "EUR" | "USD";
    hideItemPrices?: boolean;
    discountType?: "NONE" | "PERCENT" | "FIXED";
    discountValue?: number;
    items?: z.infer<typeof LINE_ITEM>[];
  };

  server.registerTool(
    "preview_invoice",
    {
      title: "Preview invoice",
      description:
        "Computes exactly what create_invoice would issue (number, items, totals, due date) WITHOUT creating anything. Invoices can't be edited once issued, so always preview and get the user's explicit OK first.",
      inputSchema: invoiceInput,
      annotations: { readOnlyHint: true },
    },
    run(async (args: InvoiceArgs) => {
      const r = await resolveInvoice(args);
      return {
        willBeNumbered: r.number,
        projectId: r.project.id,
        fromQuote: r.quote?.number ?? null,
        currency: r.currency,
        dueDate: d(r.dueDate),
        hideItemPrices: r.hideItemPrices,
        items: r.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, category: i.category })),
        discountAmount: r.discountAmount,
        subtotalExclVat: r.subtotal,
        totalInclVat: r.total,
      };
    })
  );

  server.registerTool(
    "create_invoice",
    {
      title: "Issue invoice",
      description:
        "Issues an invoice (status ISSUED, consumes the next invoice number). Cannot be edited or undone afterwards. Only call after preview_invoice and the user's explicit confirmation. Does not email it.",
      inputSchema: invoiceInput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    run(async (args: InvoiceArgs) => invoiceView(await createInvoice(user, args)))
  );

  const sendInput = {
    to: z.string().email().optional().describe("Must already be on file for the client (invoicing email or a contact). Defaults to the invoicing email, else the first project contact."),
    message: z.string().max(5000).optional().describe("Custom email body. Omit to use the company's standard text."),
    language: LANGUAGE.optional(),
  };

  server.registerTool(
    "send_quote",
    {
      title: "Email quote to client",
      description:
        "Emails the quote PDF to a client contact on file and marks a DRAFT quote as SENT. Only call after the user has seen the quote and explicitly said to send it.",
      inputSchema: { quoteId: z.string(), ...sendInput },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    run(async (args: { quoteId: string; to?: string; message?: string; language?: "en" | "cs" }) => ({ sent: true, ...(await sendQuote(user, args)) }))
  );

  server.registerTool(
    "send_invoice",
    {
      title: "Email invoice to client",
      description: "Emails the invoice PDF to a client contact on file. Only call after the user explicitly said to send it.",
      inputSchema: { invoiceId: z.string(), ...sendInput },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    run(async (args: { invoiceId: string; to?: string; message?: string; language?: "en" | "cs" }) => ({ sent: true, ...(await sendInvoice(user, args)) }))
  );
}
