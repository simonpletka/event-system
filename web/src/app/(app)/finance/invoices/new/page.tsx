import Link from "next/link";
import { requireUser, canManageFinance, eventWhereForUser, quoteWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { convertQuoteToInvoiceAction } from "@/lib/actions/finance";
import { getItemCategories } from "@/lib/actions/categories";
import { InvoiceForm } from "@/components/finance/InvoiceForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewInvoicePage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ti = t.finance.invoices;

  if (!canManageFinance(user)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{ti.newInvoiceH1}</h1>
        <p className="text-lg font-semibold text-ink">{ti.noPermCreate}</p>
      </div>
    );
  }

  const [events, company, eligibleQuotes, categoryRows] = await Promise.all([
    prisma.event.findMany({
      where: eventWhereForUser(user),
      select: { id: true, title: true, companyName: true, quotedValue: true },
      orderBy: { title: "asc" },
    }),
    prisma.companySettings.findUnique({ where: { id: "singleton" } }),
    prisma.quote.findMany({
      where: { ...quoteWhereForUser(user), status: "ACCEPTED", invoices: { none: {} } },
      include: { event: true },
      orderBy: { issuedAt: "desc" },
    }),
    getItemCategories(),
  ]);

  const dueDays = company?.defaultDueDays ?? 14;
  const defaultDueDate = new Date(new Date().getTime() + dueDays * 86400000).toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{ti.newInvoiceH1}</h1>

      {eligibleQuotes.length > 0 && (
        <div className="border border-ink/25 p-3 mb-5 max-w-2xl">
          <div className="label mb-1.5">{ti.fromAcceptedQuote}</div>
          <p className="text-[10px] placeholder-text mb-2">{ti.carriesOverNote}</p>
          {eligibleQuotes.map((q) => (
            <div key={q.id} className="flex justify-between items-center py-1.5 border-b border-ink/10 text-[13px] last:border-b-0">
              <div>
                <Link href={`/finance/quotes/${q.id}`} className="hover:text-accent">
                  {q.number}
                </Link>{" "}
                <span className="placeholder-text">
                  {ti.quoteLine(q.event.title, formatCurrency(q.total, q.currency), formatDate(q.issuedAt))}
                </span>
              </div>
              <form action={convertQuoteToInvoiceAction}>
                <input type="hidden" name="quoteId" value={q.id} />
                <button type="submit" className="btno text-[9px]">
                  {ti.convertToInvoice}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="label mb-1.5 max-w-2xl">{ti.orStartFromScratch}</div>
      <InvoiceForm events={events} categories={categoryRows.map((c) => c.name)} defaultDueDate={defaultDueDate} locale={locale} />
    </div>
  );
}
