import Link from "next/link";
import { requireUser, canManageFinance, isAdmin } from "@/lib/authz";
import { getQuoteList, type QuoteListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { QuoteStatusPill } from "@/components/StatusPill";
import { convertQuoteToInvoiceAction, deleteQuoteAction, duplicateQuoteAction } from "@/lib/actions/finance";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { QuoteStatus } from "@/generated/prisma/enums";

const STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const t = getDictionary(await getLocale());
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
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <form method="get" className="flex gap-1.5 flex-wrap items-center">
          <select name="status" defaultValue={filters.status ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">{t.finance.quotes.statusFilter}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.statusQuote[s]}
              </option>
            ))}
          </select>
          <select name="eventId" defaultValue={filters.eventId ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">{t.finance.quotes.eventFilter}</option>
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
          <input name="q" defaultValue={filters.q ?? ""} placeholder={t.common.search} className="input text-[9px] py-1.5 w-[110px]" />
          <button type="submit" className="btno text-[9px]">
            {t.finance.quotes.apply}
          </button>
        </form>
        {canManage && (
          <Link href="/finance/quotes/new" className="btn font-semibold">
            {t.finance.quotes.newQuote}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[.8fr_1.3fr_1fr_.7fr_.7fr_.8fr_.9fr_1fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5">
        <span className="heading-label">{t.finance.quotes.colNumber}</span>
        <span className="heading-label">{t.finance.quotes.colEvent}</span>
        <span className="heading-label">{t.finance.quotes.colClient}</span>
        <span className="heading-label">{t.finance.quotes.colIssued}</span>
        <span className="heading-label">{t.finance.quotes.colValidTo}</span>
        <span className="heading-label">{t.finance.quotes.colTotal}</span>
        <span className="heading-label">{t.finance.quotes.colStatus}</span>
        <span className="heading-label"></span>
      </div>

      {quotes.length === 0 && <p className="text-sm placeholder-text mt-4">{t.finance.quotes.noQuotesForYear(year)}</p>}

      {quotes.map((q) => (
        <div
          key={q.id}
          className="group grid grid-cols-[.8fr_1.3fr_1fr_.7fr_.7fr_.8fr_.9fr_1fr] gap-2.5 items-center py-3 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[13px] hover:bg-ink/5"
        >
          <Link href={`/finance/quotes/${q.id}`} className="font-medium group-hover:text-accent">
            {q.number}
          </Link>
          <Link href={`/finance/quotes/${q.id}`} className="group-hover:text-accent">
            {q.event.title}
          </Link>
          <div className="placeholder-text group-hover:!text-accent">{q.event.companyName}</div>
          <div className="placeholder-text group-hover:!text-accent">{formatDate(q.issuedAt)}</div>
          <div className="placeholder-text group-hover:!text-accent">{formatDate(q.validUntil)}</div>
          <div className="font-semibold tabular-nums group-hover:text-accent">
            {formatCurrency(q.total, q.currency)}
            {q.currency !== "CZK" && <span className="tag tag-neutral ml-1">{q.currency}</span>}
          </div>
          <div>
            <QuoteStatusPill status={q.status} t={t.statusQuote} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[9px] tracking-[0.1em] uppercase">
            {q.status === "ACCEPTED" && q.invoices.length === 0 && canManage ? (
              <form action={convertQuoteToInvoiceAction}>
                <input type="hidden" name="quoteId" value={q.id} />
                <button type="submit" className="text-accent hover:underline">
                  {t.finance.quotes.convertToInvoice}
                </button>
              </form>
            ) : q.status === "ACCEPTED" && q.invoices.length > 0 ? (
              <Link href={`/finance/invoices/${q.invoices[0].id}`} className="placeholder-text hover:text-ink">
                {t.finance.quotes.invoicedAs(q.invoices[0].number)}
              </Link>
            ) : q.status === "DRAFT" && canManage ? (
              <Link href={`/finance/quotes/${q.id}/edit`} className="hover:text-ink">
                {t.finance.quotes.edit}
              </Link>
            ) : q.status === "DECLINED" && canManage ? (
              <form action={duplicateQuoteAction}>
                <input type="hidden" name="id" value={q.id} />
                <button type="submit" className="hover:text-ink">
                  {t.finance.quotes.createNew}
                </button>
              </form>
            ) : (
              <span className="placeholder-text" title={t.finance.quotes.reminderNotWired}>
                {t.finance.quotes.remindClient}
              </span>
            )}
            {admin && (
              <ConfirmDeleteButton
                action={deleteQuoteAction}
                fields={{ id: q.id }}
                label={t.common.delete}
                pendingLabel={t.common.deleting}
                confirmMessage={t.finance.quotes.confirmDelete(q.number)}
                className="placeholder-text hover:text-warning"
              />
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-between mt-4 px-3.5">
        <div className="label">{t.finance.quotes.sortedByNote}</div>
        <div className="label">{t.finance.quotes.openValue(formatCurrency(openValue))}</div>
      </div>
    </div>
  );
}
