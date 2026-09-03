import { requireUser } from "@/lib/authz";
import { getFinanceReport } from "@/lib/queries/finance";
import { toCsv, csvResponse } from "@/lib/csv";
import { getLocale, getDictionary } from "@/lib/i18n";
import { isoDate } from "@/lib/calendar";
import type { ReportPeriod } from "@/lib/finance-period";

const PERIODS: ReportPeriod[] = ["month", "quarter", "year", "custom"];

export async function GET(req: Request) {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const period = (PERIODS.includes(sp.get("period") as ReportPeriod) ? sp.get("period") : "quarter") as ReportPeriod;
  const part = sp.get("part") ?? "summary";
  const locale = await getLocale();
  const t = getDictionary(locale).finance.reports;

  const report = await getFinanceReport(user, {
    period,
    anchor: sp.get("anchor") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    locale,
  });

  const stamp = `${isoDate(report.range.from)}_${isoDate(report.range.to)}`;

  if (part === "invoices") {
    const csv = toCsv(
      [t.colInvoice, t.colDate, t.colClient, t.colVatId, t.colRegime, t.colBase, t.colVat, t.colTotal, t.colCurrency, t.colStatus],
      report.invoices.map((i) => [
        i.number,
        isoDate(i.issuedAt),
        i.company,
        i.dic,
        i.regime,
        i.baseCzk,
        i.vatCzk,
        i.totalCzk,
        i.currency,
        i.paid ? t.statusPaid : t.statusUnpaid,
      ]),
    );
    return csvResponse(`invoices_${stamp}.csv`, csv);
  }

  if (part === "expenses") {
    const csv = toCsv(
      [t.colDate, t.colCategory, t.colProject, t.colNote, t.colGross, t.colRate, t.colVat, t.colNet, t.colReceipt],
      report.expenses.map((e) => [
        isoDate(e.date),
        e.category,
        e.projectLabel ?? t.overhead,
        e.note,
        e.gross,
        `${e.vatRate}%`,
        e.vatAmount,
        e.net,
        e.hasReceipt ? t.yes : t.no,
      ]),
    );
    return csvResponse(`expenses_${stamp}.csv`, csv);
  }

  const rows: (string | number)[][] = [
    [t.kpiInvoiced, report.income],
    [t.kpiExpenses, report.expenseNet],
    [t.plBalance, report.balance],
    [t.kpiMargin, `${report.margin}%`],
    [t.netVatOutput, report.vat.outputTotal],
    [t.netVatInput, report.vat.inputTotal],
    [t.netVatResult, report.vat.net],
    [t.kpiReceived, report.received],
    [t.kpiOverdue, report.overdue],
  ];
  return csvResponse(`summary_${stamp}.csv`, toCsv([t.colCategory, t.colTotal], rows));
}
