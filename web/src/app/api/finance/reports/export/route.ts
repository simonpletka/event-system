import { requireUser } from "@/lib/authz";
import { getReports } from "@/lib/queries/finance";
import { toCsv, csvResponse } from "@/lib/csv";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(req: Request) {
  const user = await requireUser();
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
  const report = await getReports(user, year);

  const csv = toCsv(
    ["Month", "Income", "Expenses", "Balance"],
    report.byMonth.map((m) => [MONTHS[m.month], m.income, m.expense, m.income - m.expense])
  );

  return csvResponse(`finance-report-${year}.csv`, csv);
}
