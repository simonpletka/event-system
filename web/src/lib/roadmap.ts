import type { RoadmapItemType } from "@/generated/prisma/enums";

/**
 * Production phases (build / event days / strike) are NOT stored as
 * RoadmapItem rows — they're derived from the event's own date fields and
 * shown as read-only anchors in the roadmap list.
 */
export type PhaseAnchor = {
  key: "build" | "event" | "strike";
  label: string;
  date: Date;
  endDate?: Date;
};

export function derivePhaseAnchors(
  event: { buildDate: Date | null; startDate: Date; endDate: Date; strikeDate: Date | null },
  labels: { build: string; event: string; strike: string },
): PhaseAnchor[] {
  const anchors: PhaseAnchor[] = [];
  if (event.buildDate) anchors.push({ key: "build", label: labels.build, date: event.buildDate });
  anchors.push({ key: "event", label: labels.event, date: event.startDate, endDate: event.endDate });
  if (event.strikeDate) anchors.push({ key: "strike", label: labels.strike, date: event.strikeDate });
  return anchors;
}

export type RoadmapGroup = "overdue" | "thisWeek" | "later" | "done";

/** Splits items into urgency buckets. `done` items are pulled out regardless of date. */
export function groupRoadmapItems<T extends { date: Date; done: boolean }>(
  items: T[],
  now: Date,
): Record<RoadmapGroup, T[]> {
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const groups: Record<RoadmapGroup, T[]> = { overdue: [], thisWeek: [], later: [], done: [] };
  for (const it of items) {
    if (it.done) groups.done.push(it);
    else if (it.date < now) groups.overdue.push(it);
    else if (it.date < weekEnd) groups.thisWeek.push(it);
    else groups.later.push(it);
  }
  return groups;
}

export const ROADMAP_TYPES: RoadmapItemType[] = ["TASK", "MEETING", "MILESTONE"];

export function parseRoadmapType(v: unknown): RoadmapItemType {
  return v === "MEETING" || v === "MILESTONE" ? v : "TASK";
}
