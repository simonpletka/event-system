import type { ProjectStatus } from "@/generated/prisma/enums";

/**
 * Projects list filters, shared by the server page (which reads them from the
 * URL) and the client list. Kept out of the "use client" component: a server
 * component can't call a function exported from a client module.
 */
export type StatusFilter = "all" | "in-progress" | "confirmed" | "to-invoice" | "quote";

export const STATUS_FILTERS: Record<StatusFilter, ProjectStatus[] | null> = {
  all: null,
  "in-progress": ["IN_PROGRESS"],
  confirmed: ["CONFIRMED"],
  "to-invoice": ["TO_INVOICE"],
  quote: ["QUOTE_SENT", "INQUIRY"],
};

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return value && value in STATUS_FILTERS ? (value as StatusFilter) : "all";
}

/** Where the detail page's "← Projects" link finds the list's filters again. */
export const LIST_QUERY_KEY = "projects:list-query";
