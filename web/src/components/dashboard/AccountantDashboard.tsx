import Link from "next/link";
import { getAccountantDashboard } from "@/lib/queries/dashboard";
import { getDictionary, type Locale } from "@/lib/i18n";
import { formatCurrency, formatDateRange } from "@/lib/format";
import { projectHref } from "@/lib/slug";
import type { SessionUser } from "@/lib/authz";
import { DashboardShell, LinkAction } from "./DashboardShell";
import {
  SectionHeading,
  RowCard,
  Row,
  CashflowPanel,
  ExpenseList,
  EmptyState,
} from "./widgets";

export async function AccountantDashboard({ user, locale }: { user: SessionUser; locale: Locale }) {
  const t = getDictionary(locale);
  const td = t.dashboard;
  const d = await getAccountantDashboard(user);

  return (
    <DashboardShell title={td.title} action={<LinkAction href="/finance" label={td.openFinance} />}>
      <div>
        <SectionHeading label={td.overdueInvoicesLabel} sub={td.overdueSubtitle} />
        {d.overdue.length === 0 ? (
          <EmptyState>{td.nothingWaiting}</EmptyState>
        ) : (
          <RowCard>
            {d.overdue.map((inv) => (
              <Row key={inv.id}>
                <span className="font-mono text-[11px] text-ink/45 whitespace-nowrap">{inv.number}</span>
                <span className="flex-1 min-w-0 truncate">
                  {inv.project.title}{" "}
                  <span className="placeholder-text tabular-nums">· {formatCurrency(inv.total, inv.currency)}</span>
                </span>
                <span className="tag tag-warning whitespace-nowrap">{td.daysLate(inv.daysOverdue)}</span>
                <Link
                  href={`/finance/invoices/${inv.id}`}
                  className="text-[9px] font-semibold tracking-[0.1em] uppercase border border-ink/15 rounded-full px-2.5 py-[5px] text-ink/55 hover:text-accent whitespace-nowrap"
                >
                  {td.sendReminder}
                </Link>
              </Row>
            ))}
          </RowCard>
        )}
      </div>

      <div>
        <SectionHeading label={td.quotesAwaitingResponse} sub={td.quotesAwaitingSubtitle} />
        {d.quotes.length === 0 ? (
          <EmptyState>{td.nothingWaiting}</EmptyState>
        ) : (
          <RowCard>
            {d.quotes.map((q) => (
              <Link key={q.id} href={`/finance/quotes/${q.id}`} className="block">
                <Row>
                  <span className="font-mono text-[11px] text-ink/45 whitespace-nowrap">{q.number}</span>
                  <span className="flex-1 min-w-0 truncate">{q.project.title}</span>
                  <span className="placeholder-text text-[11.5px] whitespace-nowrap hidden sm:inline">
                    {td.sentAgo(q.daysSinceSent)}
                  </span>
                  <span className="font-semibold tabular-nums whitespace-nowrap">
                    {formatCurrency(q.total, q.currency)}
                  </span>
                </Row>
              </Link>
            ))}
          </RowCard>
        )}
      </div>

      <div>
        <SectionHeading label={td.readyToInvoice} sub={td.readyToInvoiceSubtitle} />
        {d.toInvoice.length === 0 ? (
          <EmptyState>{td.nothingWaiting}</EmptyState>
        ) : (
          <RowCard>
            {d.toInvoice.map((e) => (
              <Link key={e.id} href={projectHref(e)} className="block">
                <Row>
                  <span className="flex-1 min-w-0 truncate">{e.title}</span>
                  <span className="placeholder-text text-[11.5px] whitespace-nowrap">
                    {td.endedOn(formatDateRange(e.startDate, e.endDate))}
                  </span>
                </Row>
              </Link>
            ))}
          </RowCard>
        )}
      </div>

      <CashflowPanel cashflow={d.cashflow} t={t} />

      <div>
        <SectionHeading label={td.latestExpenses} sub={td.companyWideWhoPaid} />
        <ExpenseList expenses={d.expenses} t={t} showPayer />
      </div>
    </DashboardShell>
  );
}
