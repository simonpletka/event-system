import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canManageFinance, canViewFinance } from "@/lib/authz";
import { getQuoteList, type QuoteListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { projectHref, clientHref } from "@/lib/slug";
import { QuoteStatusPill } from "@/components/StatusPill";
import { convertQuoteToInvoiceAction, duplicateQuoteAction } from "@/lib/actions/finance";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";
import { FinanceSortMenu } from "@/components/finance/FinanceSortMenu";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { groupProjectOptions } from "@/lib/project-status";
import { EmptyState } from "@/components/ui/EmptyState";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { QuoteStatus } from "@/generated/prisma/enums";

const STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (!canViewFinance(user)) redirect("/finance/expenses");
  const params = await searchParams;
  const t = getDictionary(await getLocale());
  const filters: QuoteListFilters = {
    q: params.q || undefined,
    status: (params.status as QuoteStatus) || undefined,
    projectId: params.projectId || undefined,
    year: params.year ? Number(params.year) : undefined,
    sort: params.sort || undefined,
  };
  const { quotes, openValue, projects, year } = await getQuoteList(user, filters);
  const canManage = canManageFinance(user);
  const quoteParams = {
    status: filters.status,
    projectId: filters.projectId,
    year: String(year),
    q: filters.q,
    sort: filters.sort,
  };

  return (
    <div>
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 items-center flex-nowrap overflow-x-auto pb-1 md:pb-0 md:flex-wrap md:overflow-visible">
          <FilterSelect
            label={t.finance.quotes.statusFilter}
            value={filters.status ?? ""}
            options={STATUSES.map((s) => ({ value: s, label: t.statusQuote[s] }))}
            basePath="/finance/quotes"
            params={quoteParams}
            paramName="status"
            anyLabel={t.finance.filters.anyStatus}
          />
          <FilterSelect
            label={t.finance.quotes.projectFilter}
            value={filters.projectId ?? ""}
            groups={groupProjectOptions(projects, { active: t.finance.filters.activeProjects, inactive: t.finance.filters.pastProjects })}
            basePath="/finance/quotes"
            params={quoteParams}
            paramName="projectId"
            searchable
            searchPlaceholder={t.finance.filters.searchProjects}
            emptyLabel={t.finance.filters.noMatches}
            anyLabel={t.finance.filters.anyProject}
          />
          <FilterSelect
            label={String(year)}
            value={String(year)}
            options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))}
            basePath="/finance/quotes"
            params={quoteParams}
            paramName="year"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FinanceSortMenu current={filters.sort} basePath="/finance/quotes" params={quoteParams} t={t.finance.sort} />
          {canManage && (
            <Link href="/finance/quotes/new" className="btn font-semibold">
              {t.finance.quotes.newQuote}
            </Link>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[.8fr_1.3fr_1fr_.7fr_.7fr_.8fr_.9fr_.9fr_.55fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
          <span className="heading-label">{t.finance.quotes.colNumber}</span>
          <span className="heading-label">{t.finance.quotes.colProject}</span>
          <span className="heading-label">{t.finance.quotes.colClient}</span>
          <span className="heading-label">{t.finance.quotes.colIssued}</span>
          <span className="heading-label">{t.finance.quotes.colValidTo}</span>
          <span className="heading-label">{t.finance.quotes.colTotal}</span>
          <span className="heading-label">{t.finance.quotes.colStatus}</span>
          <span className="heading-label"></span>
          <span className="heading-label">{t.finance.quotes.pdf}</span>
        </div>

        {quotes.map((q) => (
          <div
            key={q.id}
            className="group grid grid-cols-[.8fr_1.3fr_1fr_.7fr_.7fr_.8fr_.9fr_.9fr_.55fr] gap-2.5 items-center py-3.5 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[15px] hover:bg-ink/5"
          >
            <Link href={`/finance/quotes/${q.id}`} className="font-medium group-hover:text-accent">
              {q.number}
            </Link>
            <Link href={projectHref(q.project)} className="hover:text-accent">
              {q.project.title}
            </Link>
            <div className="placeholder-text group-hover:!text-accent">
              {q.project.clientId ? (
                <Link href={clientHref({ id: q.project.clientId!, name: q.project.companyName })} className="hover:text-accent">
                  {q.project.companyName}
                </Link>
              ) : (
                q.project.companyName
              )}
            </div>
            <div className="placeholder-text group-hover:!text-accent">{formatDate(q.issuedAt)}</div>
            <div className="placeholder-text group-hover:!text-accent">{formatDate(q.validUntil)}</div>
            <div className="font-semibold tabular-nums group-hover:text-accent">
              {formatCurrency(q.total, q.currency)}
            </div>
            <div>
              <QuoteStatusPill status={q.status} t={t.statusQuote} />
            </div>
            <div className="flex items-center justify-end text-[9px] tracking-[0.1em] uppercase">
              {q.status === "ACCEPTED" && q.invoices.length === 0 && canManage ? (
                <form action={convertQuoteToInvoiceAction}>
                  <input type="hidden" name="quoteId" value={q.id} />
                  <button type="submit" className="text-accent hover:opacity-70">
                    {t.finance.quotes.convertToInvoice}
                  </button>
                </form>
              ) : q.status === "ACCEPTED" && q.invoices.length > 0 ? (
                <Link href={`/finance/invoices/${q.invoices[0].id}`} className="placeholder-text hover:text-ink">
                  {t.finance.quotes.invoicedAs(q.invoices[0].number)}
                </Link>
              ) : q.status === "DRAFT" && canManage ? (
                <Link href={`/finance/quotes/${q.id}/edit`} className="placeholder-text hover:text-ink">
                  {t.finance.quotes.edit}
                </Link>
              ) : q.status === "DECLINED" && canManage ? (
                <form action={duplicateQuoteAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <button type="submit" className="placeholder-text hover:text-ink">
                    {t.finance.quotes.createNew}
                  </button>
                </form>
              ) : (
                <span className="placeholder-text" title={t.finance.quotes.reminderNotWired}>
                  {t.finance.quotes.remindClient}
                </span>
              )}
            </div>
            <DownloadPdfButton pdfUrl={`/api/quotes/${q.id}/pdf`} label={t.finance.quotes.download} subtle />
          </div>
        ))}
      </div>

      {/* Mobile: not MobileListRow -- the desktop row embeds real <form>/<button>
          actions (Convert to invoice, Duplicate, Delete), which can't legally
          nest inside MobileListRow's single wrapping <Link>. A navigable header
          plus a separate non-Link action footer keeps every action working. */}
      <div className="md:hidden flex flex-col gap-2 mt-4">
        {quotes.map((q) => (
          <div key={q.id} className="card overflow-hidden">
            <div className="relative flex items-center gap-2.5 py-3.5 px-3.5">
              <Link href={`/finance/quotes/${q.id}`} aria-hidden tabIndex={-1} className="absolute inset-0 z-0" />
              <div className="flex-1 min-w-0">
                <div className="placeholder-text text-[10.5px] mb-0.5">{q.number}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={projectHref(q.project)}
                    className="relative z-[1] text-[14px] font-semibold truncate hover:text-accent"
                  >
                    {q.project.title}
                  </Link>
                  <QuoteStatusPill status={q.status} t={t.statusQuote} />
                </div>
                <div className="placeholder-text text-[11.5px] mt-0.5">
                  {q.project.clientId ? (
                    <Link href={clientHref({ id: q.project.clientId!, name: q.project.companyName })} className="relative z-[1] hover:text-accent">
                      {q.project.companyName}
                    </Link>
                  ) : (
                    q.project.companyName
                  )}{" "}
                  · {t.finance.quotes.colIssued} {formatDate(q.issuedAt)} · {t.finance.quotes.colValidTo}{" "}
                  {formatDate(q.validUntil)}
                </div>
              </div>
              <div className="text-right shrink-0 text-[13px] font-semibold">
                {formatCurrency(q.total, q.currency)}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-[9px] tracking-[0.1em] uppercase px-3.5 pb-3 pt-2.5 border-t border-ink/8">
              {q.status === "ACCEPTED" && q.invoices.length === 0 && canManage ? (
                <form action={convertQuoteToInvoiceAction}>
                  <input type="hidden" name="quoteId" value={q.id} />
                  <button type="submit" className="text-accent hover:opacity-70">
                    {t.finance.quotes.convertToInvoice}
                  </button>
                </form>
              ) : q.status === "ACCEPTED" && q.invoices.length > 0 ? (
                <Link href={`/finance/invoices/${q.invoices[0].id}`} className="placeholder-text hover:text-ink">
                  {t.finance.quotes.invoicedAs(q.invoices[0].number)}
                </Link>
              ) : q.status === "DRAFT" && canManage ? (
                <Link href={`/finance/quotes/${q.id}/edit`} className="placeholder-text hover:text-ink">
                  {t.finance.quotes.edit}
                </Link>
              ) : q.status === "DECLINED" && canManage ? (
                <form action={duplicateQuoteAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <button type="submit" className="placeholder-text hover:text-ink">
                    {t.finance.quotes.createNew}
                  </button>
                </form>
              ) : (
                <span className="placeholder-text" title={t.finance.quotes.reminderNotWired}>
                  {t.finance.quotes.remindClient}
                </span>
              )}
              <DownloadPdfButton pdfUrl={`/api/quotes/${q.id}/pdf`} label={t.finance.quotes.download} subtle />
            </div>
          </div>
        ))}
      </div>

      {quotes.length === 0 && (
        <EmptyState
          message={t.finance.quotes.noQuotesForYear(year)}
          actionLabel={canManage && !(filters.q || filters.status || filters.projectId) ? t.finance.quotes.newQuote : undefined}
          actionHref="/finance/quotes/new"
        />
      )}

      <div className="flex justify-between mt-4 px-3.5">
        <div className="label">{t.finance.quotes.sortedByNote}</div>
        <div className="label">{t.finance.quotes.openValue(formatCurrency(openValue))}</div>
      </div>
    </div>
  );
}
