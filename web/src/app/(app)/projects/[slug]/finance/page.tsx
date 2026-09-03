import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canViewProjectBudget, canManageFinance, isAdmin, isAccountant } from "@/lib/authz";
import { getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { parseProjectSlug, projectHref } from "@/lib/slug";
import { resolveProjectBudget } from "@/lib/project-budget";
import { formatCurrency, formatCurrencyWithCzk, formatDate, isMixedCurrencyTotal } from "@/lib/format";
import { toCzkBatch } from "@/lib/fx";
import { QuoteStatusPill, InvoiceStatusPill } from "@/components/StatusPill";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { ProjectBudgetTile, budgetBasisLabel } from "@/components/projects/ProjectBudgetTile";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EventFinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const number = parseProjectSlug(slug);
  if (!number) notFound();
  const id = await resolveProjectIdByNumber(number);
  if (!id) notFound();
  if (!canViewProjectBudget(user)) notFound();
  const project = await getProjectDetail(user, id);
  if (!project) notFound();
  const t = getDictionary(await getLocale());
  const te = t.projects;
  const tf = te.finance;

  const totalExpenses = project.expenses.reduce((s, e) => s + e.amount, 0);
  // Excl. VAT — a value/revenue figure (paired with quotedValue's own margin
  // math below), not a payment-owed figure, so it reads subtotal not total.
  const totalInvoiced = (
    await toCzkBatch(project.invoices.map((i) => ({ amount: i.subtotal, currency: i.currency, date: i.issuedAt })))
  ).reduce((s, i) => s + i.czkAmount, 0);
  const paidInvoices = project.invoices.filter((i) => i.status === "PAID").length;
  const budget = resolveProjectBudget(project);
  const plannedMargin = budget.amount === null ? null : project.quotedValue - budget.amount;
  const actualMargin = project.quotedValue - totalExpenses;
  const spendRatio = budget.amount && budget.amount > 0 ? totalExpenses / budget.amount : null;
  const spentPct = spendRatio === null ? null : Math.round(spendRatio * 100);

  const mixed = isMixedCurrencyTotal([...project.quotes, ...project.invoices].map((d) => d.currency));
  const quotesWithCzk = await toCzkBatch(project.quotes.map((q) => ({ ...q, amount: q.total, date: q.issuedAt })));
  const invoicesWithCzk = await toCzkBatch(project.invoices.map((i) => ({ ...i, amount: i.total, date: i.issuedAt })));

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
          sub={project.invoices.length === 0 ? "" : tf.invoicedPaid(paidInvoices, project.invoices.length)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5 items-start">
        <ProjectBudgetTile
          t={te}
          amount={budget.amount}
          basis={isAdmin(user) || isAccountant(user) ? budgetBasisLabel(budget, project.quotedValue, te.budget) : null}
          spent={totalExpenses}
          spendRatio={spendRatio}
          plannedMargin={plannedMargin}
          actualMargin={actualMargin}
          editHref={isAdmin(user) ? projectHref(project, "/edit") : null}
        />

        <div className="flex flex-col gap-5">
          {/* Quotes */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="heading-label !text-[11px]">{tf.quotesHeading}</span>
              {canManageFinance(user) && (
                <Link href={`/finance/quotes/new?projectId=${project.id}`} className="btno text-[9px]">
                  {te.newQuoteForProject}
                </Link>
              )}
            </div>
            {project.quotes.length === 0 && <p className="text-sm placeholder-text">{tf.noQuotes}</p>}
            <div className="hidden md:block">
              {quotesWithCzk.map((q) => (
                <Link
                  key={q.id}
                  href={`/finance/quotes/${q.id}`}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-center py-2.5 border-t border-ink/8 first:border-t-0 text-[14px] hover:bg-ink/5 -mx-2 px-2 rounded-lg"
                >
                  <div className="font-medium">{q.number}</div>
                  <div className="placeholder-text">{formatDate(q.issuedAt)}</div>
                  <div className="tabular-nums">{formatCurrencyWithCzk(q.total, q.currency, q.czkAmount)}</div>
                  <QuoteStatusPill status={q.status} t={t.statusQuote} />
                </Link>
              ))}
            </div>
            <div className="md:hidden flex flex-col gap-2">
              {quotesWithCzk.map((q) => (
                <MobileListRow
                  key={q.id}
                  href={`/finance/quotes/${q.id}`}
                  title={q.number}
                  tag={<QuoteStatusPill status={q.status} t={t.statusQuote} />}
                  meta={formatDate(q.issuedAt)}
                  trailing={formatCurrencyWithCzk(q.total, q.currency, q.czkAmount)}
                />
              ))}
            </div>
          </section>

          {/* Invoices */}
          <section className="card p-5">
            <span className="heading-label !text-[11px]">{tf.invoicesHeading}</span>
            {project.invoices.length === 0 && <p className="text-sm placeholder-text mt-2">{tf.noInvoices}</p>}
            <div className="hidden md:block mt-2">
              {invoicesWithCzk.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/finance/invoices/${inv.id}`}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-center py-2.5 border-t border-ink/8 first:border-t-0 text-[14px] hover:bg-ink/5 -mx-2 px-2 rounded-lg"
                >
                  <div className="font-medium">{inv.number}</div>
                  <div className="placeholder-text">{t.projects.quotesTab.dueDate(formatDate(inv.dueDate))}</div>
                  <div className="tabular-nums">{formatCurrencyWithCzk(inv.total, inv.currency, inv.czkAmount)}</div>
                  <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />
                </Link>
              ))}
            </div>
            <div className="md:hidden flex flex-col gap-2 mt-2">
              {invoicesWithCzk.map((inv) => (
                <MobileListRow
                  key={inv.id}
                  href={`/finance/invoices/${inv.id}`}
                  title={inv.number}
                  tag={<InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />}
                  meta={t.projects.quotesTab.dueDate(formatDate(inv.dueDate))}
                  trailing={formatCurrencyWithCzk(inv.total, inv.currency, inv.czkAmount)}
                />
              ))}
            </div>
          </section>

          {/* Expenses */}
          <section className="card p-5">
            <div className="flex items-baseline justify-between mb-2">
              <span className="heading-label !text-[11px]">{tf.expensesHeading}</span>
              <span className="text-[12px] font-semibold tabular-nums">{tf.expensesTotal(formatCurrency(totalExpenses), project.expenses.length)}</span>
            </div>
            {project.expenses.length === 0 && <p className="text-sm placeholder-text">{tf.noExpenses}</p>}
            {project.expenses.map((exp) => (
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
