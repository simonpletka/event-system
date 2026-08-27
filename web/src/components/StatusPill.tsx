import type { EventStatus, InvoiceStatus, QuoteStatus } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/i18n";

// Four status roles, so a list of pills reads at a glance:
//   positive  (teal)  — a good outcome: confirmed, accepted, paid
//   attention (amber) — in flight / waiting on someone / act soon:
//                       quote out, needs invoicing, partly paid, due this week
//   warning   (red)   — negative or urgent: cancelled, declined, overdue
//   neutral   (grey)  — nothing pending: draft, inquiry, in progress, closed
// Teal is never used for a CTA, so a status can't be mistaken for a button.
type TagRole = "positive" | "attention" | "warning" | "neutral";

const EVENT_STATUS_VARIANT: Record<EventStatus, TagRole> = {
  INQUIRY: "neutral",
  QUOTE_SENT: "attention",
  CONFIRMED: "positive",
  IN_PROGRESS: "neutral",
  TO_INVOICE: "attention",
  CLOSED: "neutral",
  CANCELLED: "warning",
};

export function EventStatusPill({ status, t }: { status: EventStatus; t: Dictionary["statusEvent"] }) {
  return <span className={`tag tag-${EVENT_STATUS_VARIANT[status]}`}>{t[status]}</span>;
}

const QUOTE_STATUS_VARIANT: Record<QuoteStatus, TagRole> = {
  DRAFT: "neutral",
  SENT: "attention",
  ACCEPTED: "positive",
  DECLINED: "warning",
};

export function QuoteStatusPill({ status, t }: { status: QuoteStatus; t: Dictionary["statusQuote"] }) {
  return <span className={`tag tag-${QUOTE_STATUS_VARIANT[status]}`}>{t[status]}</span>;
}

/**
 * Invoice payment-state pill. "Overdue" isn't a stored status — it's derived
 * from dueDate/amountPaid — so this takes the raw fields rather than a status enum.
 * Overdue and due-in-under-3-days are warning-red (urgent); due this week
 * and partly-paid are amber (on your radar); issued-and-not-yet-due neutral.
 */
export function InvoiceStatusPill({
  status,
  dueDate,
  paidAt,
  t,
}: {
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date | null;
  t: Dictionary["invoicePill"];
}) {
  if (status === "PAID") {
    return <span className="tag tag-positive">{paidAt ? t.paidOn(formatShort(paidAt)) : t.paid}</span>;
  }
  const now = new Date().getTime();
  const msUntilDue = dueDate.getTime() - now;
  const overdue = msUntilDue < 0;
  if (overdue) {
    const days = Math.floor(-msUntilDue / 86400000);
    return <span className="tag tag-warning">{t.overdueDays(days)}</span>;
  }
  if (status === "PARTLY_PAID") return <span className="tag tag-attention">{t.partlyPaid}</span>;
  if (msUntilDue <= 3 * 86400000) {
    const days = Math.floor(msUntilDue / 86400000);
    return <span className="tag tag-warning">{days <= 0 ? t.dueToday : t.dueInDays(days)}</span>;
  }
  if (msUntilDue <= 7 * 86400000) return <span className="tag tag-attention">{t.dueSoon}</span>;
  return <span className="tag tag-neutral">{t.issued}</span>;
}

function formatShort(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}
