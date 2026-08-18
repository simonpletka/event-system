import Link from "next/link";
import { requireUser, canManageFinance } from "@/lib/authz";
import { getInvoiceList, getInvoiceKpis, type InvoiceListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filters: InvoiceListFilters = {
    bucket: (params.bucket as InvoiceListFilters["bucket"]) || undefined,
    eventId: params.eventId || undefined,
  };
  const [{ invoices, total, events }, kpis] = await Promise.all([
    getInvoiceList(user, filters),
    getInvoiceKpis(user),
  ]);
  const canManage = canManageFinance(user);

  const buckets: { key: NonNullable<InvoiceListFilters["bucket"]> | ""; label: string }[] = [
    { key: "", label: "All" },
    { key: "issued", label: "Issued" },
    { key: "paid", label: "Paid" },
    { key: "overdue", label: "Overdue" },
    { key: "partly_paid", label: "Partly paid" },
  ];

  return (
    <div>
      <div className="flex justify-end gap-2">
        {canManage && (
          <>
            <a href="/api/finance/invoices/export" className="btno">
              Export for accounting
            </a>
            <Link href="/finance/invoices/new" className="btn">
              New invoice
            </Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 mt-4">
        <KpiCell label="Issued, unpaid" value={kpis.issuedUnpaid} />
        <KpiCell label="Overdue" value={kpis.overdue} attention />
        <KpiCell label="Due in 7 days" value={kpis.dueSoon} />
        <KpiCell label="Paid this month" value={kpis.paidThisMonth} />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap mt-4">
        <div className="flex gap-2 flex-wrap">
          {buckets.map((b) => (
            <Link
              key={b.key}
              href={b.key ? `/finance/invoices?bucket=${b.key}` : "/finance/invoices"}
              className={`text-[11px] font-semibold tracking-[0.04em] px-3.5 py-2 rounded-full border ${
                (filters.bucket ?? "") === b.key
                  ? "bg-accent border-accent text-ink"
                  : "border-ink/16 bg-ink/4 text-ink/65 hover:text-ink"
              }`}
            >
              {b.label}
            </Link>
          ))}
        </div>
        <form method="get" className="flex gap-1.5">
          {filters.bucket && <input type="hidden" name="bucket" value={filters.bucket} />}
          <select name="eventId" defaultValue={filters.eventId ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">Event ▾</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <button type="submit" className="btno text-[9px]">
            Apply
          </button>
        </form>
      </div>

      <div className="grid grid-cols-[.8fr_1.2fr_.9fr_.6fr_.6fr_.8fr_1fr_.7fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5">
        <span className="heading-label">Number</span>
        <span className="heading-label">Event</span>
        <span className="heading-label">Client</span>
        <span className="heading-label">Issued</span>
        <span className="heading-label">Due ↑</span>
        <span className="heading-label">Total</span>
        <span className="heading-label">Payment</span>
        <span className="heading-label">PDF</span>
      </div>

      {invoices.length === 0 && <p className="text-sm placeholder-text mt-4">No invoices match this filter.</p>}

      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="group grid grid-cols-[.8fr_1.2fr_.9fr_.6fr_.6fr_.8fr_1fr_.7fr] gap-2.5 items-center py-3 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[13px] hover:bg-ink/5"
        >
          <Link href={`/finance/invoices/${inv.id}`} className="font-medium group-hover:text-accent">
            {inv.number}
          </Link>
          <Link href={`/finance/invoices/${inv.id}`} className="group-hover:text-accent">
            {inv.event.title}
          </Link>
          <div className="placeholder-text group-hover:!text-accent">{inv.event.companyName}</div>
          <div className="placeholder-text group-hover:!text-accent">{formatDate(inv.issuedAt)}</div>
          <div className="placeholder-text group-hover:!text-accent">{formatDate(inv.dueDate)}</div>
          <div className="font-semibold tabular-nums group-hover:text-accent">
            {formatCurrency(inv.total, inv.currency)}
            {inv.currency !== "CZK" && <span className="tag tag-neutral ml-1">{inv.currency}</span>}
          </div>
          <div>
            <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} />
          </div>
          <DownloadPdfButton
            pdfUrl={`/api/invoices/${inv.id}/pdf`}
            label="Download"
            className="text-[9px] tracking-[0.1em] uppercase hover:text-accent"
          />
        </div>
      ))}

      <div className="flex justify-between mt-4 px-3.5">
        <div className="label">Sorted by due date · overdue first · email reminders aren&apos;t wired up yet</div>
        <div className="label">
          Showing {invoices.length} of {total}
        </div>
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  attention,
}: {
  label: string;
  value: { count: number; total: number };
  attention?: boolean;
}) {
  const isWarning = attention && value.count > 0;
  return (
    <div className={`card relative overflow-hidden px-5 py-4 ${isWarning ? "border-warning/30" : ""}`}>
      {isWarning && <div className="absolute top-0 left-0 right-0 h-0.5 bg-warning" />}
      <div className={`heading-label ${isWarning ? "text-warning" : ""}`}>{label}</div>
      <div className={`text-[26px] font-semibold tracking-tight mt-1 ${isWarning ? "text-warning" : ""}`}>{formatCurrency(value.total)}</div>
      <div className="placeholder-text text-[10px] mt-0.5">
        {value.count} invoice{value.count === 1 ? "" : "s"}
      </div>
    </div>
  );
}
