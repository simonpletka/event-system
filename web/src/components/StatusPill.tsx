import type { EventStatus, InvoiceStatus, QuoteStatus } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/i18n";

// Positive = teal (a "good" outcome — never orange, so it's never mistaken
// for a call-to-action). Warning = red, reserved strictly for things that
// need attention (overdue, due very soon, cancelled/declined). Neutral
// covers everything else, including routine in-progress states.
const EVENT_STATUS_VARIANT: Record<EventStatus, "positive" | "warning" | "neutral"> = {
  INQUIRY: "neutral",
  QUOTE_SENT: "neutral",
  CONFIRMED: "positive",
  IN_PROGRESS: "neutral",
  TO_INVOICE: "warning",
  CLOSED: "neutral",
  CANCELLED: "warning",
};

export function EventStatusPill({ status, t }: { status: EventStatus; t: Dictionary["statusEvent"] }) {
  return <span className={`tag tag-${EVENT_STATUS_VARIANT[status]}`}>{t[status]}</span>;
}

const QUOTE_STATUS_VARIANT: Record<QuoteStatus, "positive" | "warning" | "neutral"> = {
  DRAFT: "neutral",
  SENT: "neutral",
  ACCEPTED: "positive",
  DECLINED: "warning",
};

export function QuoteStatusPill({ status, t }: { status: QuoteStatus; t: Dictionary["statusQuote"] }) {
  return <span className={`tag tag-${QUOTE_STATUS_VARIANT[status]}`}>{t[status]}</span>;
}

/**
 * Invoice payment-state pill. "Overdue" isn't a stored status — it's derived
 * from dueDate/amountPaid — so this takes the raw fields rather than a status enum.
 * "Due soon" (3-7 days out) stays neutral; under 3 days switches to the
 * warning-red tag, same as overdue — the two together are what the "red
 * means a warning" rule actually means for invoices.
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
  if (status === "PARTLY_PAID") return <span className="tag tag-neutral">{t.partlyPaid}</span>;
  if (msUntilDue <= 3 * 86400000) {
    const days = Math.floor(msUntilDue / 86400000);
    return <span className="tag tag-warning">{days <= 0 ? t.dueToday : t.dueInDays(days)}</span>;
  }
  if (msUntilDue <= 7 * 86400000) return <span className="tag tag-neutral">{t.dueSoon}</span>;
  return <span className="tag tag-neutral">{t.issued}</span>;
}

function formatShort(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}
