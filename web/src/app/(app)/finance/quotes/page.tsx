import Link from "next/link";
import { requireUser, canManageFinance, isAdmin } from "@/lib/authz";
import { getQuoteList, type QuoteListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { QuoteStatusPill } from "@/components/StatusPill";
import { convertQuoteToInvoiceAction, deleteQuoteAction, duplicateQuoteAction } from "@/lib/actions/finance";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import type { QuoteStatus } from "@/generated/prisma/enums";

const STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filters: QuoteListFilters = {
    q: params.q || undefined,
    status: (params.status as QuoteStatus) || undefined,
    eventId: params.eventId || undefined,
    year: params.year ? Number(params.year) : undefined,
  };
  const { quotes, openValue, events, year } = await getQuoteList(user, filters);
  const canManage = canManageFinance(user);
  const admin = isAdmin(user);

  return (
    <div>
      <div className="flex justify-between items-center gap-2 flex-wrap mt-1">
        <form method="get" className="flex gap-1.5 flex-wrap items-center">
          <select name="status" defaultValue={filters.status ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">Status ▾</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="eventId" defaultValue={filters.eventId ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">Event ▾</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <select name="year" defaultValue={String(year)} className="btno bg-transparent text-[9px]">
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search…"
            className="border border-ink/35 bg-transparent px-2 py-1.5 text-[9px] w-[110px]"
          />
          <button type="submit" className="btno text-[9px]">
            Apply
          </button>
        </form>
        {canManage && (
          <Link href="/finance/quotes/new" className="btn">
            New quote
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[.8fr_1.3fr_1fr_.7fr_.7fr_.8fr_.9fr_1fr] gap-2.5 border-b-2 border-ink pb-1.5 mt-3">
        <span className="heading-label">Number</span>
        <span className="heading-label">Event</span>
        <span className="heading-label">Client</span>
        <span className="heading-label">Issued</span>
        <span className="heading-label">Valid to</span>
        <span className="heading-label">Total</span>
        <span className="heading-label">Status</span>
        <span className="heading-label"></span>
      </div>

      {quotes.length === 0 && <p className="text-sm placeholder-text mt-4">No quotes for {year}.</p>}

      {quotes.map((q) => (
        <div
          key={q.id}
          className="group grid grid-cols-[.8fr_1.3fr_1fr_.7fr_.7fr_.8fr_.9fr_1fr] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px] hover:bg-ink/5"
        >
          <Link href={`/finance/quotes/${q.id}`} className="group-hover:text-accent">
            {q.number}
          </Link>
          <Link href={`/finance/quotes/${q.id}`} className="group-hover:text-accent">
            {q.event.title}
          </Link>
          <div className="placeholder-text group-hover:!text-accent">{q.event.companyName}</div>
          <div className="placeholder-text group-hover:!text-accent">{formatDate(q.issuedAt)}</div>
          <div className="placeholder-text group-hover:!text-accent">{formatDate(q.validUntil)}</div>
          <div className="group-hover:text-accent">
            {formatCurrency(q.total, q.currency)}
            {q.currency !== "CZK" && <span className="pill ml-1 !border-accent text-accent">{q.currency}</span>}
          </div>
          <div>
            <QuoteStatusPill status={q.status} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[9px] tracking-[0.1em] uppercase">
            {q.status === "ACCEPTED" && q.invoices.length === 0 && canManage ? (
              <form action={convertQuoteToInvoiceAction}>
                <input type="hidden" name="quoteId" value={q.id} />
                <button type="submit" className="text-accent hover:underline">
                  Convert to invoice →
                </button>
              </form>
            ) : q.status === "ACCEPTED" && q.invoices.length > 0 ? (
              <Link href={`/finance/invoices/${q.invoices[0].id}`} className="placeholder-text hover:text-ink">
                Invoiced {q.invoices[0].number}
              </Link>
            ) : q.status === "DRAFT" && canManage ? (
              <Link href={`/finance/quotes/${q.id}/edit`} className="hover:text-ink">
                Edit
              </Link>
            ) : q.status === "DECLINED" && canManage ? (
              <form action={duplicateQuoteAction}>
                <input type="hidden" name="id" value={q.id} />
                <button type="submit" className="hover:text-ink">
                  Create new →
                </button>
              </form>
            ) : (
              <span className="placeholder-text" title="Reminder emails aren't wired up yet">
                Remind client
              </span>
            )}
            {admin && (
              <ConfirmDeleteButton
                action={deleteQuoteAction}
                fields={{ id: q.id }}
                confirmMessage={`Delete quote ${q.number}? This can't be undone.`}
                className="placeholder-text hover:text-accent"
              />
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-between mt-3">
        <div className="label">
          Sorted by issue date — newest first · accepted quotes carry their items and client data into the invoice
        </div>
        <div className="label">Open value {formatCurrency(openValue)}</div>
      </div>
    </div>
  );
}
