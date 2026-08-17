import type { EventStatus, InvoiceStatus, QuoteStatus } from "@/generated/prisma/enums";

const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  INQUIRY: "Inquiry",
  QUOTE_SENT: "Quote sent",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  TO_INVOICE: "To invoice",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const EVENT_STATUS_ATTENTION: Partial<Record<EventStatus, boolean>> = {
  TO_INVOICE: true,
  CANCELLED: true,
};

export function EventStatusPill({ status }: { status: EventStatus }) {
  return (
    <span className={`pill ${EVENT_STATUS_ATTENTION[status] ? "pill-red" : ""}`}>
      {EVENT_STATUS_LABEL[status]}
    </span>
  );
}

const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Rejected",
};

export function QuoteStatusPill({ status }: { status: QuoteStatus }) {
  return <span className={`pill ${status === "DECLINED" ? "pill-red" : ""}`}>{QUOTE_STATUS_LABEL[status]}</span>;
}

/**
 * Invoice payment-state pill. "Overdue" isn't a stored status — it's derived
 * from dueDate/amountPaid — so this takes the raw fields rather than a status enum.
 */
export function InvoiceStatusPill({
  status,
  dueDate,
  paidAt,
}: {
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date | null;
}) {
  if (status === "PAID") {
    return <span className="pill">{paidAt ? `Paid ${formatShort(paidAt)}` : "Paid"}</span>;
  }
  const now = new Date().getTime();
  const overdue = dueDate.getTime() < now;
  if (overdue) {
    const days = Math.max(0, Math.floor((now - dueDate.getTime()) / 86400000));
    return <span className="pill pill-red">Overdue {days} d</span>;
  }
  const dueSoon = dueDate.getTime() - now <= 7 * 86400000;
  if (status === "PARTLY_PAID") return <span className="pill">Partly paid</span>;
  if (dueSoon) return <span className="pill">Due soon</span>;
  return <span className="pill">Issued</span>;
}

function formatShort(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}
