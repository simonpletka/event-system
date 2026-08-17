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
  DECLINED: "Declined",
};

export function QuoteStatusPill({ status }: { status: QuoteStatus }) {
  return <span className={`pill ${status === "DECLINED" ? "pill-red" : ""}`}>{QUOTE_STATUS_LABEL[status]}</span>;
}

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  ISSUED: "Issued",
  PARTLY_PAID: "Partly paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

export function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return <span className={`pill ${status === "OVERDUE" ? "pill-red" : ""}`}>{INVOICE_STATUS_LABEL[status]}</span>;
}
