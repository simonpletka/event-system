import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatCurrency, formatDate } from "@/lib/format";
import { QuoteStatusPill, InvoiceStatusPill } from "@/components/StatusPill";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function QuotesTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();
  const t = getDictionary(await getLocale());
  const tq = t.events.quotesTab;

  return (
    <div className="max-w-2xl">
      <div className="heading-label mb-1">{tq.quotesHeading}</div>
      {event.quotes.length === 0 && <p className="text-sm placeholder-text">{tq.noQuotesYet}</p>}
      <div className="hidden md:block">
        {event.quotes.map((q) => (
          <Link
            key={q.id}
            href={`/finance/quotes/${q.id}`}
            className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px] hover:bg-ink/5"
          >
            <div>{q.number}</div>
            <div className="placeholder-text">{formatDate(q.issuedAt)}</div>
            <div>{formatCurrency(q.total, q.currency)}</div>
            <QuoteStatusPill status={q.status} t={t.statusQuote} />
          </Link>
        ))}
      </div>
      <div className="md:hidden flex flex-col gap-2">
        {event.quotes.map((q) => (
          <MobileListRow
            key={q.id}
            href={`/finance/quotes/${q.id}`}
            title={q.number}
            tag={<QuoteStatusPill status={q.status} t={t.statusQuote} />}
            meta={formatDate(q.issuedAt)}
            trailing={formatCurrency(q.total, q.currency)}
          />
        ))}
      </div>

      <div className="heading-label mt-4 mb-1">{tq.invoicesHeading}</div>
      {event.invoices.length === 0 && <p className="text-sm placeholder-text">{tq.noInvoicesYet}</p>}
      <div className="hidden md:block">
        {event.invoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/finance/invoices/${inv.id}`}
            className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px] hover:bg-ink/5"
          >
            <div>{inv.number}</div>
            <div className="placeholder-text">{tq.dueDate(formatDate(inv.dueDate))}</div>
            <div>{formatCurrency(inv.total, inv.currency)}</div>
            <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />
          </Link>
        ))}
      </div>
      <div className="md:hidden flex flex-col gap-2">
        {event.invoices.map((inv) => (
          <MobileListRow
            key={inv.id}
            href={`/finance/invoices/${inv.id}`}
            title={inv.number}
            tag={<InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />}
            meta={tq.dueDate(formatDate(inv.dueDate))}
            trailing={formatCurrency(inv.total, inv.currency)}
          />
        ))}
      </div>
    </div>
  );
}
