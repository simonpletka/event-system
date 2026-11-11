import type { ProjectStatus } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/dictionary";

/**
 * Status colours for the Projects redesign. Deliberately separate from the
 * shared ProjectStatusPill (still used by the dashboard and Clients), whose
 * mapping differs: here In progress is amber and To invoice is red.
 */
const TONE: Record<ProjectStatus, "positive" | "attention" | "warning" | "neutral"> = {
  IN_PROGRESS: "attention",
  CONFIRMED: "positive",
  TO_INVOICE: "warning",
  QUOTE_SENT: "neutral",
  INQUIRY: "neutral",
  CLOSED: "neutral",
  CANCELLED: "neutral",
};

export function ProjectStatusChip({ status, t }: { status: ProjectStatus; t: Dictionary["statusProject"] }) {
  return <span className={`tag tag-${TONE[status]} whitespace-nowrap`}>{t[status]}</span>;
}
