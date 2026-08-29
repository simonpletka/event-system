import type { EventStatus } from "@/generated/prisma/enums";
import type { FilterOptionGroup } from "@/components/ui/FilterSelect";

/** A live event you might still work on — everything except the terminal states. */
export function isActiveEvent(status: EventStatus) {
  return status !== "CLOSED" && status !== "CANCELLED";
}

/**
 * Split an event picker's options into "active first, then done/cancelled" —
 * the inactive ones are rarely what you're filtering by.
 */
export function groupEventOptions(
  events: { id: string; title: string; status: EventStatus }[],
  labels: { active: string; inactive: string },
): FilterOptionGroup[] {
  const active = events.filter((e) => isActiveEvent(e.status)).map((e) => ({ value: e.id, label: e.title }));
  const inactive = events.filter((e) => !isActiveEvent(e.status)).map((e) => ({ value: e.id, label: e.title }));
  const groups: FilterOptionGroup[] = [];
  if (active.length) groups.push({ label: labels.active, options: active });
  if (inactive.length) groups.push({ label: labels.inactive, options: inactive });
  return groups;
}
