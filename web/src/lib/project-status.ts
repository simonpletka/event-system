import type { ProjectStatus } from "@/generated/prisma/enums";
import type { FilterOptionGroup } from "@/components/ui/FilterSelect";

/** A live project you might still work on — everything except the terminal states. */
export function isActiveProject(status: ProjectStatus) {
  return status !== "CLOSED" && status !== "CANCELLED";
}

/**
 * Split a project picker's options into "active first, then done/cancelled" —
 * the inactive ones are rarely what you're filtering by.
 */
export function groupProjectOptions(
  projects: { id: string; title: string; status: ProjectStatus }[],
  labels: { active: string; inactive: string },
): FilterOptionGroup[] {
  const active = projects.filter((e) => isActiveProject(e.status)).map((e) => ({ value: e.id, label: e.title }));
  const inactive = projects.filter((e) => !isActiveProject(e.status)).map((e) => ({ value: e.id, label: e.title }));
  const groups: FilterOptionGroup[] = [];
  if (active.length) groups.push({ label: labels.active, options: active });
  if (inactive.length) groups.push({ label: labels.inactive, options: inactive });
  return groups;
}
