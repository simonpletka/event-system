import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canViewFinance } from "@/lib/authz";
import { getFinanceReport, type FinanceReport, type AgingBucket } from "@/lib/queries/finance";
import { formatCurrency, formatCompactCurrency, formatDate, niceMoneyAxis } from "@/lib/format";
import { projectHref } from "@/lib/slug";
import { rangeLabel as periodRangeLabel, resolveRange, type ReportPeriod } from "@/lib/finance-period";
import { isoDate } from "@/lib/calendar";
import { PrintButton } from "@/components/finance/PrintButton";
import { MonthlyBarChart } from "@/components/finance/MonthlyBarChart";
import { ReportPeriodControls, type ReportQuery } from "@/components/finance/reports/ReportPeriodControls";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { INCOME_CHART_COLOR, categoricalColor } from "@/lib/chart-colors";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { VatRegime } from "@/lib/vat-regime";

const PERIODS: ReportPeriod[] = ["month", "quarter", "year", "custom"];
const TABS = ["overview", "vat", "receivables", "documents"] as const;
type Tab = (typeof TABS)[number];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (!canViewFinance(user)) redirect("/finance/expenses");

  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const tr = t.finance.reports;

  const period = (PERIODS.includes(params.period as ReportPeriod) ? params.period : "quarter") as ReportPeriod;
  const anchor = params.anchor || isoDate(new Date());
  const from = params.from || "";
  const to = params.to || "";
  const tab = (TABS.includes(params.tab as Tab) ? params.tab : "overview") as Tab;
  const printAll = params.print === "all";

  const report = await getFinanceReport(user, { period, anchor, from, to, locale });
  const { from: rangeFrom, to: rangeTo } = resolveRange(period, anchor, from, to);
  const query: ReportQuery = { period, anchor, from, to, tab };

  const csvHref = (part: string) => {
    const sp = new URLSearchParams({ period, part });
    if (period === "custom") {
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
    } else sp.set("anchor", anchor);
    return `/api/finance/reports/export?${sp.toString()}`;
  };

  const tabOptions = TABS.map((v) => ({
    value: v,
    label: v === "overview" ? tr.tabOverview : v === "vat" ? tr.tabVat : v === "receivables" ? tr.tabReceivables : tr.tabDocuments,
    href: `/finance/reports?tab=${v}&period=${period}${period === "custom" ? `&from=${from}&to=${to}` : `&anchor=${anchor}`}`,
  }));

  const netVat = report.vat.net;

  return (
    <div>
      <div className="flex justify-between items-start gap-2 mt-1 flex-wrap">
        <ReportPeriodControls
          query={query}
          rangeLabel={periodRangeLabel(period, rangeFrom, rangeTo, locale)}
          labels={{
            month: tr.periodMonth,
            quarter: tr.periodQuarter,
            year: tr.periodYear,
            custom: tr.periodCustom,
            from: tr.fromLabel,
            to: tr.toLabel,
            apply: tr.apply,
            thisPeriod: tr.thisPeriod,
          }}
        />
        <div className="flex gap-2 print-hide">
          <a href={csvHref("summary")} className="btno">
            {tr.exportSummaryCsv}
          </a>
          <PrintButton label={tr.print} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        <Kpi label={tr.kpiInvoiced} value={formatCurrency(report.income)} />
        <Kpi label={tr.kpiExpenses} value={formatCurrency(report.expenseNet)} />
        <Kpi label={tr.kpiMargin} value={`${report.margin}%`} />
        {report.isVatPayer && (
          <Kpi
            label={tr.kpiNetVat}
            value={formatCurrency(Math.abs(netVat))}
            sub={netVat >= 0 ? tr.netVatToPay : tr.netVatToReclaim}
          />
        )}
        <Kpi label={tr.kpiReceived} value={formatCurrency(report.received)} />
        <Kpi label={tr.kpiOverdue} value={formatCurrency(report.overdue)} warn={report.overdue > 0} />
      </div>

      <div className="mt-5 print-hide">
        <SegmentedTabs options={tabOptions} active={tab} />
      </div>

      {(printAll || tab === "overview") && <OverviewSection report={report} tr={tr} t={t} />}
      {(printAll || tab === "vat") && <VatSection report={report} tr={tr} />}
      {(printAll || tab === "receivables") && <ReceivablesSection report={report} tr={tr} />}
      {(printAll || tab === "documents") && <DocumentsSection report={report} tr={tr} t={t} csvHref={csvHref} />}
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

type Tr = ReturnType<typeof getDictionary>["finance"]["reports"];
type Dict = ReturnType<typeof getDictionary>;

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`card relative overflow-hidden px-4 py-3.5 ${warn ? "border-warning/35" : ""}`}>
      {warn && <div className="absolute top-0 inset-x-0 h-0.5 bg-warning" />}
      <div className="heading-label !text-[9px]">{label}</div>
      <div className={`text-[18px] md:text-[20px] font-bold tracking-tight tabular-nums mt-1.5 ${warn ? "text-warning" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] placeholder-text mt-0.5 uppercase tracking-[0.08em]">{sub}</div>}
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card px-4 py-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="heading-label !text-[11px] font-bold">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function HeadRow({ cols, template }: { cols: string[]; template: string }) {
  return (
    <div className="grid gap-2 border-b-2 border-ink pb-1.5" style={{ gridTemplateColumns: template }}>
      {cols.map((c, i) => (
        <span
          key={i}
          className={`heading-label !text-[9px] font-bold ${i === 0 ? "" : "text-right"}`}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function money(n: number) {
  return formatCurrency(n);
}

function regimeLabel(r: VatRegime, tr: Tr) {
  return r === "domestic" ? tr.regimeDomestic : r === "eu" ? tr.regimeEu : tr.regimeExport;
}

function agingLabel(b: AgingBucket, tr: Tr) {
  return b === "current" ? tr.agingCurrent : b === "d1_30" ? tr.agingD1_30 : b === "d31_60" ? tr.agingD31_60 : tr.agingD60plus;
}

/* --------------------------------------------------------------- Overview */

function OverviewSection({ report, tr, t }: { report: FinanceReport; tr: Tr; t: Dict }) {
  const maxBucket = Math.max(1, ...report.byBucket.flatMap((b) => [b.income, b.expense]));
  const { axisMax, ticks } = niceMoneyAxis(maxBucket);
  const maxCategory = Math.max(1, ...report.topCategories.map(([, v]) => v));

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
      <div className="flex flex-col gap-4">
        <Card title={tr.chartTitle}>
          <div className="flex gap-3.5 mb-1">
            <Legend color={INCOME_CHART_COLOR} label={tr.legendIncome} />
            <Legend swatch="bg-accent" label={tr.legendExpenses} />
          </div>
          <MonthlyBarChart
            months={report.byBucket}
            axisMax={axisMax}
            axisTicks={ticks.map((v) => formatCompactCurrency(v))}
            incomeColor={INCOME_CHART_COLOR}
            labels={{ income: tr.legendIncome, expenses: tr.legendExpenses, balance: tr.plBalance }}
          />
        </Card>

        <Card title={tr.byProjectTitle}>
          {report.byProject.length === 0 ? (
            <p className="text-sm placeholder-text">{tr.empty}</p>
          ) : (
            <>
              <HeadRow cols={[tr.colProject, tr.colIncome, tr.colExpenses, tr.colBalance]} template="1fr .8fr .8fr .8fr" />
              {report.byProject.map((p) => (
                <Link
                  key={p.id}
                  href={projectHref(p)}
                  className="grid gap-2 items-center py-2.5 border-b border-ink/12 text-[14px] hover:bg-ink/5"
                  style={{ gridTemplateColumns: "1fr .8fr .8fr .8fr" }}
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-right tabular-nums placeholder-text">{money(p.income)}</span>
                  <span className="text-right tabular-nums placeholder-text">{money(p.expense)}</span>
                  <span className="text-right tabular-nums">{money(p.income - p.expense)}</span>
                </Link>
              ))}
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card title={tr.plTitle}>
          <PlRow label={tr.plInvoiced} value={money(report.income)} />
          <PlRow label={tr.plExpensesNet} value={`− ${money(report.expenseNet)}`} />
          <PlRow label={tr.plBalance} value={money(report.balance)} strong />
          <PlRow label={tr.plMargin} value={`${report.margin}%`} />
          <div className="rule-thin my-2" />
          <PlRow label={tr.plExpensesGross} value={money(report.expenseGross)} muted />
        </Card>

        {report.currencyExposure.length > 0 && (
          <Card title={tr.currencyExposureTitle}>
            <HeadRow cols={[tr.colCurrency, tr.colOriginal, tr.colCzk]} template="1fr 1fr 1fr" />
            {report.currencyExposure.map((c) => (
              <div key={c.currency} className="grid gap-2 py-2 text-[14px] tabular-nums" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <span>{c.currency}</span>
                <span className="text-right placeholder-text">{formatCurrency(c.original, c.currency)}</span>
                <span className="text-right">{money(c.czk)}</span>
              </div>
            ))}
            {report.mixedCurrency && <p className="text-[10px] placeholder-text mt-2">{tr.mixedCurrencyNote}</p>}
          </Card>
        )}

        <Card title={tr.topCategories}>
          {report.topCategories.length === 0 ? (
            <p className="text-sm placeholder-text">{tr.empty}</p>
          ) : (
            report.topCategories.map(([cat, value], i) => (
              <div key={cat} className="flex flex-col gap-1 py-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: categoricalColor(i) }} />
                    {t.expenseCategories[cat as keyof typeof t.expenseCategories] ?? cat}
                  </span>
                  <span className="placeholder-text tabular-nums text-[12px]">{money(value)}</span>
                </div>
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${(value / maxCategory) * 100}%`, maxWidth: 180, background: categoricalColor(i) }}
                />
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

function PlRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 text-[14px] ${muted ? "placeholder-text" : ""}`}>
      <span className={strong ? "font-semibold" : ""}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-bold text-[16px]" : ""}`}>{value}</span>
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

/* -------------------------------------------------------------------- VAT */

function VatSection({ report, tr }: { report: FinanceReport; tr: Tr }) {
  if (!report.isVatPayer) {
    return <p className="text-sm placeholder-text mt-4 card px-4 py-4">{tr.notVatPayerNote}</p>;
  }
  const v = report.vat;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-[11px] placeholder-text">{tr.vatEstimateNote}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={tr.revenueByRegimeTitle}>
          <HeadRow cols={[tr.colRegime, tr.colBase, tr.colCount]} template="1.4fr 1fr .5fr" />
          {v.revenueByRegime.map((r) => (
            <div key={r.regime} className="grid gap-2 py-2 text-[14px] tabular-nums" style={{ gridTemplateColumns: "1.4fr 1fr .5fr" }}>
              <span>{regimeLabel(r.regime, tr)}</span>
              <span className="text-right">{money(r.base)}</span>
              <span className="text-right placeholder-text">{r.count}</span>
            </div>
          ))}
        </Card>

        <Card title={tr.netVatTitle}>
          <PlRow label={tr.netVatOutput} value={money(v.outputTotal)} />
          <PlRow label={tr.netVatInput} value={`− ${money(v.inputTotal)}`} />
          <div className="rule-thin my-2" />
          <PlRow
            label={v.net >= 0 ? `${tr.netVatResult} · ${tr.netVatToPay}` : `${tr.netVatResult} · ${tr.netVatToReclaim}`}
            value={money(Math.abs(v.net))}
            strong
          />
        </Card>

        <Card title={tr.outputVatTitle}>
          <HeadRow cols={[tr.colRate, tr.colBase, tr.colVat]} template="1fr 1fr 1fr" />
          {v.outputByRate.map((r) => (
            <div key={r.rate} className="grid gap-2 py-2 text-[14px] tabular-nums" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <span>{r.rate}%</span>
              <span className="text-right placeholder-text">{money(r.base)}</span>
              <span className="text-right">{money(r.vat)}</span>
            </div>
          ))}
        </Card>

        <Card title={tr.inputVatTitle}>
          {v.inputByRate.length === 0 ? (
            <p className="text-sm placeholder-text">{tr.noInputVatNote}</p>
          ) : (
            <>
              <HeadRow cols={[tr.colRate, tr.colBase, tr.colVat]} template="1fr 1fr 1fr" />
              {v.inputByRate.map((r) => (
                <div key={r.rate} className="grid gap-2 py-2 text-[14px] tabular-nums" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <span>{r.rate}%</span>
                  <span className="text-right placeholder-text">{money(r.base)}</span>
                  <span className="text-right">{money(r.vat)}</span>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>

      <Card title={tr.ecSalesTitle}>
        {v.ecSalesList.length === 0 ? (
          <p className="text-sm placeholder-text">{tr.ecSalesEmpty}</p>
        ) : (
          <>
            <HeadRow cols={[tr.colClient, tr.colVatId, tr.colBase, tr.colCount]} template="1.2fr 1fr 1fr .5fr" />
            {v.ecSalesList.map((r) => (
              <div key={r.dic} className="grid gap-2 py-2 text-[14px]" style={{ gridTemplateColumns: "1.2fr 1fr 1fr .5fr" }}>
                <span className="truncate">{r.name}</span>
                <span className="tabular-nums">{r.dic}</span>
                <span className="text-right tabular-nums">{money(r.base)}</span>
                <span className="text-right tabular-nums placeholder-text">{r.count}</span>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- Receivables */

function ReceivablesSection({ report, tr }: { report: FinanceReport; tr: Tr }) {
  const totalOutstanding = report.receivablesAging.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {report.receivablesAging.map((b) => (
          <div key={b.bucket} className={`card px-4 py-3.5 ${b.bucket === "d60_plus" && b.amount > 0 ? "border-warning/35" : ""}`}>
            <div className="heading-label !text-[9px]">{agingLabel(b.bucket, tr)}</div>
            <div className="text-[17px] font-bold tabular-nums mt-1.5">{money(b.amount)}</div>
            <div className="text-[10px] placeholder-text mt-0.5">{b.count}</div>
          </div>
        ))}
      </div>

      <Card title={tr.cashTitle}>
        <PlRow label={tr.cashInvoiced} value={money(report.income)} />
        <PlRow label={tr.cashReceived} value={money(report.received)} />
        <PlRow label={tr.cashOutstanding} value={money(report.periodOutstanding)} />
      </Card>

      <Card title={`${tr.outstandingTitle} · ${money(totalOutstanding)}`}>
        {report.outstandingInvoices.length === 0 ? (
          <p className="text-sm placeholder-text">{tr.receivablesEmpty}</p>
        ) : (
          <>
            <HeadRow
              cols={[tr.colInvoice, tr.colDue, tr.colOverdue, tr.colRemaining]}
              template="1fr 1fr .7fr 1fr"
            />
            {report.outstandingInvoices.map((i) => (
              <div key={i.id} className="grid gap-2 py-2 text-[14px]" style={{ gridTemplateColumns: "1fr 1fr .7fr 1fr" }}>
                <span className="truncate">
                  {i.number} · <span className="placeholder-text">{i.company}</span>
                </span>
                <span className="tabular-nums">{formatDate(i.dueDate, { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className={`text-right tabular-nums ${i.overdueDays > 0 ? "text-warning" : "placeholder-text"}`}>
                  {i.overdueDays > 0 ? tr.days(i.overdueDays) : "—"}
                </span>
                <span className="text-right tabular-nums">{money(i.remainingCzk)}</span>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- Documents */

function DocumentsSection({
  report,
  tr,
  t,
  csvHref,
}: {
  report: FinanceReport;
  tr: Tr;
  t: Dict;
  csvHref: (part: string) => string;
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <Card
        title={tr.invoicesTitle}
        action={
          <a href={csvHref("invoices")} className="btno text-[10px] px-2.5 py-1 print-hide">
            {tr.exportInvoicesCsv}
          </a>
        }
      >
        {report.invoices.length === 0 ? (
          <p className="text-sm placeholder-text">{tr.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <HeadRow
                cols={[tr.colInvoice, tr.colDate, tr.colRegime, tr.colBase, tr.colVat, tr.colTotal, tr.colStatus]}
                template="1.1fr .8fr .9fr .9fr .8fr .9fr .7fr"
              />
              {report.invoices.map((i) => (
                <div
                  key={i.id}
                  className="grid gap-2 py-2 text-[13px] items-center border-b border-ink/10"
                  style={{ gridTemplateColumns: "1.1fr .8fr .9fr .9fr .8fr .9fr .7fr" }}
                >
                  <span className="truncate">
                    {i.number} · <span className="placeholder-text">{i.company}</span>
                  </span>
                  <span className="tabular-nums">{formatDate(i.issuedAt, { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="text-right">{regimeLabel(i.regime, tr)}</span>
                  <span className="text-right tabular-nums placeholder-text">{money(i.baseCzk)}</span>
                  <span className="text-right tabular-nums placeholder-text">{money(i.vatCzk)}</span>
                  <span className="text-right tabular-nums">
                    {formatCurrency(i.total, i.currency)}
                    {i.currency !== "CZK" && <span className="placeholder-text"> · {money(i.totalCzk)}</span>}
                  </span>
                  <span className={`text-right ${i.paid ? "text-positive" : "text-warning"}`}>
                    {i.paid ? tr.statusPaid : tr.statusUnpaid}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card
        title={tr.expensesTitle}
        action={
          <a href={csvHref("expenses")} className="btno text-[10px] px-2.5 py-1 print-hide">
            {tr.exportExpensesCsv}
          </a>
        }
      >
        {report.expenses.length === 0 ? (
          <p className="text-sm placeholder-text">{tr.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <HeadRow
                cols={[tr.colDate, tr.colCategory, tr.colProject, tr.colGross, tr.colVat, tr.colNet, tr.colReceipt]}
                template=".8fr 1fr 1fr .8fr .7fr .8fr .5fr"
              />
              {report.expenses.map((e) => (
                <div
                  key={e.id}
                  className="grid gap-2 py-2 text-[13px] items-center border-b border-ink/10"
                  style={{ gridTemplateColumns: ".8fr 1fr 1fr .8fr .7fr .8fr .5fr" }}
                >
                  <span className="tabular-nums">{formatDate(e.date, { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="truncate">{t.expenseCategories[e.category as keyof typeof t.expenseCategories] ?? e.category}</span>
                  <span className="truncate placeholder-text">{e.projectLabel ?? tr.overhead}</span>
                  <span className="text-right tabular-nums">{money(e.gross)}</span>
                  <span className="text-right tabular-nums placeholder-text">{money(e.vatAmount)}</span>
                  <span className="text-right tabular-nums">{money(e.net)}</span>
                  <span className="text-right placeholder-text">{e.hasReceipt ? tr.yes : tr.no}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
