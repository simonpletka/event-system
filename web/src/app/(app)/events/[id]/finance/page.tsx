import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canViewEventBudget, canManageFinance, isAdmin, isAccountant } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { resolveEventBudget } from "@/lib/event-budget";
import { formatCurrency, formatDate, isMixedCurrencyTotal } from "@/lib/format";
import { QuoteStatusPill, InvoiceStatusPill } from "@/components/StatusPill";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { EventBudgetTile, budgetBasisLabel } from "@/components/events/EventBudgetTile";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EventFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!canViewEventBudget(user)) notFound();
  const event = await getEventDetail(user, id);
  if (!event) notFound();
  const t = getDictionary(await getLocale());
  const te = t.events;
  const tf = te.finance;

  const totalExpenses = event.expenses.reduce((s, e) => s + e.amount, 0);
  const totalInvoiced = event.invoices.reduce((s, i) => s + i.total, 0);
  const paidInvoices = event.invoices.filter((i) => i.status === "PAID").length;
  const budget = resolveEventBudget(event);
  const plannedMargin = budget.amount === null ? null : event.quotedValue - budget.amount;
  const actualMargin = event.quotedValue - totalExpenses;
  const spendRatio = budget.amount && budget.amount > 0 ? totalExpenses / budget.amount : null;
  const spentPct = spendRatio === null ? null : Math.round(spendRatio * 100);

  const mixed = isMixedCurrencyTotal([...event.quotes, ...event.invoices].map((d) => d.currency));

  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={tf.kpiBudget} value={budget.amount === null ? "—" : formatCurrency(budget.amount)} sub={budget.amount === null ? tf.noBudgetSet : ""} />
        <Kpi
          label={tf.kpiSpent}
          value={formatCurrency(totalExpenses)}
          sub={spentPct === null ? "" : tf.spentOfBudget(spentPct)}
          tone={spentPct !== null && spentPct > 100 ? "warning" : spentPct !== null && spentPct >= 85 ? "attention" : undefined}
        />
        <Kpi
          label={tf.kpiPlannedMargin}
          value={plannedMargin === null ? "—" : formatCurrency(plannedMargin)}
          sub={te.stats.quotedMinusBudget}
          tone={plannedMargin !== null && plannedMargin < 0 ? "warning" : "positive"}
        />
        <Kpi
          label={tf.kpiInvoiced}
          value={formatCurrency(totalInvoiced)}
          sub={event.invoices.length === 0 ? "" : tf.invoicedPaid(paidInvoices, event.invoices.length)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5 items-start">
        <EventBudgetTile
          t={te}
          amount={budget.amount}
          basis={isAdmin(user) || isAccountant(user) ? budgetBasisLabel(budget, event.quotedValue, te.budget) : null}
          spent={totalExpenses}
          spendRatio={spendRatio}
          plannedMargin={plannedMargin}
          actualMargin={actualMargin}
          editHref={isAdmin(user) ? `/events/${event.id}/edit` : null}
        />

        <div className="flex flex-col gap-5">
          {/* Quotes */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="heading-label !text-[11px]">{tf.quotesHeading}</span>
              {canManageFinance(user) && (
                <Link href={`/finance/quotes/new?eventId=${event.id}`} className="btno text-[9px]">
                  {te.newQuoteForEvent}
                </Link>
              )}
            </div>
            {event.quotes.length === 0 && <p className="text-sm placeholder-text">{tf.noQuotes}</p>}
            <div className="hidden md:block">
              {event.quotes.map((q) => (
                <Link
                  key={q.id}
                  href={`/finance/quotes/${q.id}`}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-center py-2.5 border-t border-ink/8 first:border-t-0 text-[14px] hover:bg-ink/5 -mx-2 px-2 rounded-lg"
                >
                  <div className="font-medium">{q.number}</div>
                  <div className="placeholder-text">{formatDate(q.issuedAt)}</div>
                  <div className="tabular-nums">{formatCurrency(q.total, q.currency)}</div>
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
          </section>

          {/* Invoices */}
          <section className="card p-5">
            <span className="heading-label !text-[11px]">{tf.invoicesHeading}</span>
            {event.invoices.length === 0 && <p className="text-sm placeholder-text mt-2">{tf.noInvoices}</p>}
            <div className="hidden md:block mt-2">
              {event.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/finance/invoices/${inv.id}`}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-center py-2.5 border-t border-ink/8 first:border-t-0 text-[14px] hover:bg-ink/5 -mx-2 px-2 rounded-lg"
                >
                  <div className="font-medium">{inv.number}</div>
                  <div className="placeholder-text">{t.events.quotesTab.dueDate(formatDate(inv.dueDate))}</div>
                  <div className="tabular-nums">{formatCurrency(inv.total, inv.currency)}</div>
                  <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />
                </Link>
              ))}
            </div>
            <div className="md:hidden flex flex-col gap-2 mt-2">
              {event.invoices.map((inv) => (
                <MobileListRow
                  key={inv.id}
                  href={`/finance/invoices/${inv.id}`}
                  title={inv.number}
                  tag={<InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />}
                  meta={t.events.quotesTab.dueDate(formatDate(inv.dueDate))}
                  trailing={formatCurrency(inv.total, inv.currency)}
                />
              ))}
            </div>
          </section>

          {/* Expenses */}
          <section className="card p-5">
            <div className="flex items-baseline justify-between mb-2">
              <span className="heading-label !text-[11px]">{tf.expensesHeading}</span>
              <span className="text-[12px] font-semibold tabular-nums">{tf.expensesTotal(formatCurrency(totalExpenses), event.expenses.length)}</span>
            </div>
            {event.expenses.length === 0 && <p className="text-sm placeholder-text">{tf.noExpenses}</p>}
            {event.expenses.map((exp) => (
              <div key={exp.id} className="grid grid-cols-[80px_1fr_auto] md:grid-cols-[80px_1fr_1fr_auto] gap-2.5 items-center py-2.5 border-t border-ink/8 first:border-t-0 text-[13px]">
                <div className="placeholder-text">{formatDate(exp.date)}</div>
                <div>{t.expenseCategories[exp.category]}</div>
                <div className="placeholder-text hidden md:block truncate">
                  {exp.paidBy.name}
                  {exp.note ? ` · ${exp.note}` : ""}
                </div>
                <div className="font-semibold tabular-nums">{formatCurrency(exp.amount)}</div>
              </div>
            ))}
          </section>

          {mixed && <p className="text-[10px] placeholder-text">{tf.mixedCurrencyNote}</p>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "positive" | "attention" | "warning" }) {
  const cls = tone === "positive" ? "text-positive" : tone === "attention" ? "text-attention" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="card px-4 py-3.5">
      <div className="heading-label !text-[8px]">{label}</div>
      <div className={`text-[19px] font-semibold tracking-tight mt-1.5 tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="placeholder-text text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}
