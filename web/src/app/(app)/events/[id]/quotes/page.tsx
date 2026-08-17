import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatCurrency, formatDate } from "@/lib/format";
import { QuoteStatusPill, InvoiceStatusPill } from "@/components/StatusPill";

export default async function QuotesTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();

  return (
    <div className="max-w-2xl">
      <div className="heading-label mb-1">Quotes</div>
      {event.quotes.length === 0 && <p className="text-sm placeholder-text">No quotes yet.</p>}
      {event.quotes.map((q) => (
        <Link
          key={q.id}
          href={`/finance/quotes/${q.id}`}
          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px] hover:bg-ink/5"
        >
          <div>{q.number}</div>
          <div className="placeholder-text">{formatDate(q.issuedAt)}</div>
          <div>{formatCurrency(q.total, q.currency)}</div>
          <QuoteStatusPill status={q.status} />
        </Link>
      ))}

      <div className="heading-label mt-4 mb-1">Invoices</div>
      {event.invoices.length === 0 && <p className="text-sm placeholder-text">No invoices yet.</p>}
      {event.invoices.map((inv) => (
        <Link
          key={inv.id}
          href={`/finance/invoices/${inv.id}`}
          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px] hover:bg-ink/5"
        >
          <div>{inv.number}</div>
          <div className="placeholder-text">due {formatDate(inv.dueDate)}</div>
          <div>{formatCurrency(inv.total, inv.currency)}</div>
          <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} />
        </Link>
      ))}
    </div>
  );
}
