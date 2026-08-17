import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getReports } from "@/lib/queries/finance";
import { formatCurrency } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expense-categories";
import { PrintButton } from "@/components/finance/PrintButton";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const view = (params.view as "event" | "month" | "category") || "month";
  const year = Number(params.year) || new Date().getFullYear();
  const report = await getReports(user, year);

  const maxMonthly = Math.max(1, ...report.byMonth.flatMap((m) => [m.income, m.expense]));
  const maxCategory = Math.max(1, ...report.topCategories.map(([, v]) => v));

  return (
    <div>
      <div className="flex justify-end gap-2 mt-1 print-hide">
        <a href={`/api/finance/reports/export?year=${year}`} className="btno">
          Export CSV
        </a>
        <PrintButton />
      </div>

      <div className="flex justify-between items-center gap-2 mt-3 pb-2.5 border-b border-ink/20 flex-wrap print-hide">
        <div className="flex border border-ink">
          {(["month", "event", "category"] as const).map((v) => (
            <Link
              key={v}
              href={`/finance/reports?view=${v}&year=${year}`}
              className={`text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 ${
                view === v ? "bg-ink text-bg" : "border-l border-ink first:border-l-0"
              }`}
            >
              {v === "month" ? "Overview" : `By ${v}`}
            </Link>
          ))}
        </div>
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

      <div className="flex mt-3 border border-ink/20">
        <ReportKpi label="Income" value={formatCurrency(report.income)} />
        <ReportKpi label="Expenses" value={formatCurrency(report.expense)} />
        <ReportKpi label="Balance" value={formatCurrency(report.balance)} />
        <ReportKpi label="Margin" value={`${report.margin}%`} last />
      </div>

      {view === "month" && (
        <div className="grid grid-cols-[1.35fr_1fr] gap-4 mt-4">
          <div>
            <div className="label mb-2">Income vs expenses by month</div>
            <div className="flex items-end gap-2.5 h-[170px] border-b-2 border-ink border-l border-ink/20 pl-1">
              {report.byMonth.map((m) => (
                <div key={m.month} className="flex gap-0.5 items-end h-full" title={`${MONTHS[m.month]}: income ${formatCurrency(m.income)}, expenses ${formatCurrency(m.expense)}`}>
                  <div className="w-2.5 bg-ink/70" style={{ height: `${(m.income / maxMonthly) * 100}%` }} />
                  <div className="w-2.5 bg-accent" style={{ height: `${(m.expense / maxMonthly) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 pl-1 mt-1">
              {MONTHS.map((m) => (
                <span key={m} className="label w-2.5 text-center" style={{ width: "22px" }}>
                  {m}
                </span>
              ))}
            </div>
            <div className="flex gap-3.5 mt-2">
              <Legend swatch="bg-ink/70" label="Income" />
              <Legend swatch="bg-accent" label="Expenses" />
            </div>
          </div>

          <div>
            <div className="label mb-1">Breakdown</div>
            <div className="grid grid-cols-[1fr_.7fr_.7fr_.6fr] gap-2 border-b-2 border-ink pb-1">
              <span className="heading-label">Month</span>
              <span className="heading-label">Income</span>
              <span className="heading-label">Expenses</span>
              <span className="heading-label">Balance</span>
            </div>
            {report.byMonth.map((m) => (
              <div key={m.month} className="grid grid-cols-[1fr_.7fr_.7fr_.6fr] gap-2 py-1.5 text-[13px]">
                <div>{MONTHS[m.month]}</div>
                <div className="placeholder-text">{formatCurrency(m.income)}</div>
                <div className="placeholder-text">{formatCurrency(m.expense)}</div>
                <div>{formatCurrency(m.income - m.expense)}</div>
              </div>
            ))}

            <div className="rule-thin my-3" />
            <div className="label mb-1.5">Top expense categories</div>
            {report.topCategories.map(([cat, value]) => (
              <div key={cat} className="grid grid-cols-[1fr_60px_.6fr] gap-2.5 items-center py-1.5">
                <div className="text-[13px]">{EXPENSE_CATEGORY_LABEL[cat as keyof typeof EXPENSE_CATEGORY_LABEL]}</div>
                <div className="h-1.5 bg-accent" style={{ width: `${(value / maxCategory) * 60}px` }} />
                <div className="placeholder-text text-[12px]">{formatCurrency(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "event" && (
        <div className="mt-4">
          <div className="grid grid-cols-[1fr_.8fr_.8fr_.7fr] gap-2.5 border-b-2 border-ink pb-1.5">
            <span className="heading-label">Event</span>
            <span className="heading-label">Income</span>
            <span className="heading-label">Expenses</span>
            <span className="heading-label">Balance</span>
          </div>
          {report.byEvent.length === 0 && <p className="text-sm placeholder-text mt-3">No data for {year}.</p>}
          {report.byEvent.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="grid grid-cols-[1fr_.8fr_.8fr_.7fr] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px] hover:bg-ink/5"
            >
              <div>{e.title}</div>
              <div className="placeholder-text">{formatCurrency(e.income)}</div>
              <div className="placeholder-text">{formatCurrency(e.expense)}</div>
              <div>{formatCurrency(e.income - e.expense)}</div>
            </Link>
          ))}
        </div>
      )}

      {view === "category" && (
        <div className="mt-4 max-w-xl">
          <div className="grid grid-cols-[1fr_100px_.6fr] gap-2.5 border-b-2 border-ink pb-1.5">
            <span className="heading-label">Category</span>
            <span className="heading-label"></span>
            <span className="heading-label">Total</span>
          </div>
          {report.topCategories.length === 0 && <p className="text-sm placeholder-text mt-3">No expenses in {year}.</p>}
          {report.topCategories.map(([cat, value]) => (
            <div key={cat} className="grid grid-cols-[1fr_100px_.6fr] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px]">
              <div>{EXPENSE_CATEGORY_LABEL[cat as keyof typeof EXPENSE_CATEGORY_LABEL]}</div>
              <div className="h-2 bg-accent" style={{ width: `${(value / maxCategory) * 100}px` }} />
              <div>{formatCurrency(value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportKpi({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex-1 px-2.5 py-2 ${last ? "" : "border-r border-ink/20"}`}>
      <div className="heading-label">{label}</div>
      <div className="text-xl font-semibold tracking-tight mt-0.5">{value}</div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex gap-1.5 items-center">
      <div className={`w-2.5 h-2.5 ${swatch}`} />
      <div className="label">{label}</div>
    </div>
  );
}
