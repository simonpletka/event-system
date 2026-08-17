import Link from "next/link";
import { requireUser, canManageFinance } from "@/lib/authz";
import { getInvoiceList, getInvoiceKpis, type InvoiceListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { InvoiceStatusPill } from "@/components/StatusPill";

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
      <div className="flex justify-end gap-2 mt-1">
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

      <div className="flex mt-3 border border-ink/20">
        <KpiCell label="Issued, unpaid" value={kpis.issuedUnpaid} />
        <KpiCell label="Overdue" value={kpis.overdue} attention />
        <KpiCell label="Due in 7 days" value={kpis.dueSoon} />
        <KpiCell label="Paid this month" value={kpis.paidThisMonth} last />
      </div>

      <div className="flex gap-1.5 flex-wrap pb-2.5 mt-2.5 border-b border-ink/20">
        {buckets.map((b) => (
          <Link
            key={b.key}
            href={b.key ? `/finance/invoices?bucket=${b.key}` : "/finance/invoices"}
            className={`btno text-[9px] ${(filters.bucket ?? "") === b.key ? "bg-ink text-bg" : ""}`}
          >
            {b.label}
          </Link>
        ))}
        <form method="get" className="flex gap-1.5 ml-auto">
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

      <div className="grid grid-cols-[.8fr_1.2fr_.9fr_.6fr_.6fr_.8fr_1fr_.7fr] gap-2.5 border-b-2 border-ink pb-1.5 mt-1.5">
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
          className="grid grid-cols-[.8fr_1.2fr_.9fr_.6fr_.6fr_.8fr_1fr_.7fr] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px]"
        >
          <Link href={`/finance/invoices/${inv.id}`} className="hover:text-accent">
            {inv.number}
          </Link>
          <Link href={`/events/${inv.eventId}`} className="hover:text-accent">
            {inv.event.title}
          </Link>
          <div className="placeholder-text">{inv.event.companyName}</div>
          <div className="placeholder-text">{formatDate(inv.issuedAt)}</div>
          <div className="placeholder-text">{formatDate(inv.dueDate)}</div>
          <div>
            {formatCurrency(inv.total, inv.currency)}
            {inv.currency !== "CZK" && <span className="pill ml-1 !border-accent text-accent">{inv.currency}</span>}
          </div>
          <div>
            <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} />
          </div>
          <a
            href={`/api/invoices/${inv.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="text-[9px] tracking-[0.1em] uppercase hover:text-accent"
          >
            Download
          </a>
        </div>
      ))}

      <div className="flex justify-between mt-3">
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
  last,
}: {
  label: string;
  value: { count: number; total: number };
  attention?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex-1 px-2.5 py-2 ${last ? "" : "border-r border-ink/20"}`}>
      <div className={`heading-label ${attention && value.count > 0 ? "text-accent" : ""}`}>{label}</div>
      <div className={`text-xl font-semibold tracking-tight mt-0.5 ${attention && value.count > 0 ? "text-accent" : ""}`}>
        {formatCurrency(value.total)}
      </div>
      <div className="placeholder-text text-[9px]">
        {value.count} invoice{value.count === 1 ? "" : "s"}
      </div>
    </div>
  );
}
