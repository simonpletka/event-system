import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canViewFinance } from "@/lib/authz";
import { getReports } from "@/lib/queries/finance";
import { formatCurrency, formatCompactCurrency, niceMoneyAxis } from "@/lib/format";
import { PrintButton } from "@/components/finance/PrintButton";
import { MonthlyBarChart } from "@/components/finance/MonthlyBarChart";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { INCOME_CHART_COLOR, categoricalColor as categoryColor } from "@/lib/chart-colors";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (!canViewFinance(user)) redirect("/finance/expenses");
  const params = await searchParams;
  const t = getDictionary(await getLocale());
  const tr = t.finance.reports;
  const MONTHS = tr.months;
  const view = (params.view as "event" | "month" | "category") || "month";
  const year = Number(params.year) || new Date().getFullYear();
  const report = await getReports(user, year);

  const maxMonthly = Math.max(1, ...report.byMonth.flatMap((m) => [m.income, m.expense]));
  const { axisMax, ticks: axisTickValues } = niceMoneyAxis(maxMonthly);
  const axisTicks = axisTickValues.map((v) => formatCompactCurrency(v));
  const maxCategory = Math.max(1, ...report.topCategories.map(([, v]) => v));

  const tabOptions = (["month", "event", "category"] as const).map((v) => ({
    value: v,
    label: v === "month" ? tr.tabOverview : v === "event" ? tr.tabByEvent : tr.tabByCategory,
    href: `/finance/reports?view=${v}&year=${year}`,
  }));

  return (
    <div>
      <div className="flex justify-end gap-2 mt-1 print-hide">
        <a href={`/api/finance/reports/export?year=${year}`} className="btno">
          {tr.exportCsv}
        </a>
        <PrintButton label={t.finance.print.print} />
      </div>

      <div className="flex justify-between items-center gap-2 mt-3 flex-wrap print-hide">
        <SegmentedTabs options={tabOptions} active={view} />
        <div className="flex items-center gap-1.5">
          <Link href={`/finance/reports?view=${view}&year=${year - 1}`} className="btno px-2 py-1.5">
            ←
          </Link>
          <span className="text-[10px] tracking-[0.1em] uppercase min-w-[50px] text-center">{year}</span>
          <Link href={`/finance/reports?view=${view}&year=${year + 1}`} className="btno px-2 py-1.5">
            →
          </Link>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-3 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:overflow-visible mt-4">
        <ReportKpi label={tr.kpiIncome} value={formatCurrency(report.income)} />
        <ReportKpi label={tr.kpiExpenses} value={formatCurrency(report.expense)} />
        <ReportKpi label={tr.kpiBalance} value={formatCurrency(report.balance)} />
        <ReportKpi label={tr.kpiMargin} value={`${report.margin}%`} />
      </div>

      {view === "month" && (
        <div className="grid grid-cols-1 md:grid-cols-[1.35fr_1fr] gap-4 mt-4">
          <div className="card px-4 py-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div className="label !text-[12px] mb-2">{tr.chartTitle}</div>
              <div className="flex gap-3.5">
                <Legend color={INCOME_CHART_COLOR} label={tr.legendIncome} />
                <Legend swatch="bg-accent" label={tr.legendExpenses} />
              </div>
            </div>
            <MonthlyBarChart
              months={report.byMonth.map((m) => ({ label: MONTHS[m.month], income: m.income, expense: m.expense }))}
              axisMax={axisMax}
              axisTicks={axisTicks}
              incomeColor={INCOME_CHART_COLOR}
              labels={{ income: tr.legendIncome, expenses: tr.legendExpenses, balance: tr.colBalance }}
            />
          </div>

          <div className="card px-4 py-4">
            <div className="label !text-[12px] mb-1">{tr.breakdown}</div>
            <div className="hidden md:block">
              <div className="grid grid-cols-[1fr_.7fr_.7fr_.6fr] gap-2 border-b-2 border-ink pb-1 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
                <span className="heading-label">{tr.colMonth}</span>
                <span className="heading-label">{tr.colIncome}</span>
                <span className="heading-label">{tr.colExpenses}</span>
                <span className="heading-label">{tr.colBalance}</span>
              </div>
              {report.byMonth.map((m) => (
                <div key={m.month} className="grid grid-cols-[1fr_.7fr_.7fr_.6fr] gap-2 py-2 text-[15px]">
                  <div>{MONTHS[m.month]}</div>
                  <div className="placeholder-text">{formatCurrency(m.income)}</div>
                  <div className="placeholder-text">{formatCurrency(m.expense)}</div>
                  <div>{formatCurrency(m.income - m.expense)}</div>
                </div>
              ))}
            </div>
            <div className="md:hidden flex flex-col gap-1.5">
              {report.byMonth.map((m) => (
                <div key={m.month} className="flex items-center justify-between py-1.5 border-b border-ink/8 last:border-b-0 text-[13px]">
                  <span className="font-medium">{MONTHS[m.month]}</span>
                  <span className="placeholder-text text-[11.5px]">
                    {tr.legendIncome} {formatCurrency(m.income)} · {tr.legendExpenses} {formatCurrency(m.expense)}
                  </span>
                  <span className="font-semibold shrink-0 ml-2">{formatCurrency(m.income - m.expense)}</span>
                </div>
              ))}
            </div>

            <div className="rule-thin my-3" />
            <div className="label !text-[12px] mb-1.5">{tr.topCategories}</div>
            {report.topCategories.map(([cat, value], i) => (
              <div key={cat} className="flex flex-col gap-1 py-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: categoryColor(i) }} />
                    {t.expenseCategories[cat as keyof typeof t.expenseCategories]}
                  </span>
                  <span className="placeholder-text text-[12px]">{formatCurrency(value)}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ width: `${(value / maxCategory) * 100}%`, maxWidth: 160, background: categoryColor(i) }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "event" && (
        <div className="mt-4">
          <div className="hidden md:block">
            <div className="grid grid-cols-[1fr_.8fr_.8fr_.7fr] gap-2.5 border-b-2 border-ink pb-1.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
              <span className="heading-label">{tr.colEvent}</span>
              <span className="heading-label">{tr.colIncome}</span>
              <span className="heading-label">{tr.colExpenses}</span>
              <span className="heading-label">{tr.colBalance}</span>
            </div>
            {report.byEvent.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="grid grid-cols-[1fr_.8fr_.8fr_.7fr] gap-2.5 items-center py-3 border-b border-ink/13 text-[15px] hover:bg-ink/5"
              >
                <div>{e.title}</div>
                <div className="placeholder-text">{formatCurrency(e.income)}</div>
                <div className="placeholder-text">{formatCurrency(e.expense)}</div>
                <div>{formatCurrency(e.income - e.expense)}</div>
              </Link>
            ))}
          </div>

          <div className="md:hidden flex flex-col gap-2">
            {report.byEvent.map((e) => (
              <MobileListRow
                key={e.id}
                href={`/events/${e.id}`}
                title={e.title}
                meta={`${tr.colIncome}: ${formatCurrency(e.income)} · ${tr.colExpenses}: ${formatCurrency(e.expense)}`}
                trailing={formatCurrency(e.income - e.expense)}
              />
            ))}
          </div>

          {report.byEvent.length === 0 && <p className="text-sm placeholder-text mt-3">{tr.noDataForYear(year)}</p>}
        </div>
      )}

      {view === "category" && (
        <div className="mt-4 max-w-xl">
          <div className="hidden md:block">
            <div className="grid grid-cols-[1fr_100px_.6fr] gap-2.5 border-b-2 border-ink pb-1.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
              <span className="heading-label">{tr.colCategory}</span>
              <span className="heading-label"></span>
              <span className="heading-label">{tr.colTotal}</span>
            </div>
            {report.topCategories.map(([cat, value], i) => (
              <div key={cat} className="grid grid-cols-[1fr_100px_.6fr] gap-2.5 items-center py-3 border-b border-ink/13 text-[15px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: categoryColor(i) }} />
                  {t.expenseCategories[cat as keyof typeof t.expenseCategories]}
                </div>
                <div className="h-2 rounded-full" style={{ width: `${(value / maxCategory) * 100}px`, background: categoryColor(i) }} />
                <div>{formatCurrency(value)}</div>
              </div>
            ))}
          </div>

          <div className="md:hidden flex flex-col gap-2.5">
            {report.topCategories.map(([cat, value], i) => (
              <div key={cat} className="flex flex-col gap-1.5 py-2.5 border-b border-ink/13 last:border-b-0 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: categoryColor(i) }} />
                    {t.expenseCategories[cat as keyof typeof t.expenseCategories]}
                  </span>
                  <span>{formatCurrency(value)}</span>
                </div>
                <div className="h-2 rounded-full" style={{ width: `${(value / maxCategory) * 100}%`, background: categoryColor(i) }} />
              </div>
            ))}
          </div>

          {report.topCategories.length === 0 && <p className="text-sm placeholder-text mt-3">{tr.noExpensesInYear(year)}</p>}
        </div>
      )}
    </div>
  );
}

function ReportKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card shrink-0 w-[132px] md:w-auto px-4 py-4">
      <div className="heading-label">{label}</div>
      <div className="text-[20px] font-semibold tracking-tight mt-1">{value}</div>
    </div>
  );
}

function Legend({ swatch, color, label }: { swatch?: string; color?: string; label: string }) {
  return (
    <div className="flex gap-1.5 items-center">
      <div className={`w-2.5 h-2.5 rounded-sm ${swatch ?? ""}`} style={color ? { background: color } : undefined} />
      <div className="label">{label}</div>
    </div>
  );
}
