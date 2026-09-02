import { requireUser } from "@/lib/authz";
import { getInvoiceList, isOverdue } from "@/lib/queries/finance";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatDate } from "@/lib/format";

export async function GET() {
  const user = await requireUser();
  const { invoices } = await getInvoiceList(user, {});

  const csv = toCsv(
    ["Number", "Event", "Client", "Issued", "Due", "Total", "Paid", "Status"],
    invoices.map((inv) => [
      inv.number,
      inv.project.title,
      inv.project.companyName,
      formatDate(inv.issuedAt),
      formatDate(inv.dueDate),
      inv.total,
      inv.amountPaid,
      inv.status === "PAID" ? "Paid" : isOverdue(inv) ? "Overdue" : inv.status === "PARTLY_PAID" ? "Partly paid" : "Issued",
    ])
  );

  return csvResponse(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
