import { getDictionary, type Locale } from "@/lib/dictionary";
import { formatDay } from "./shared";

const TONE: Record<string, string> = {
  OK: "tag-positive",
  NEEDS_ATTENTION: "tag-attention",
  DAMAGED: "tag-warning",
  IN_SERVICE: "tag-attention",
  RETIRED: "tag-neutral",
  LOST: "tag-warning",
};

/** A unit's condition as a status chip; IN_SERVICE adds its expected return. Server- and client-safe. */
export function ConditionChip({ condition, backAt, locale }: { condition: string; backAt?: string | null; locale: Locale }) {
  const t = getDictionary(locale).gear;
  return (
    <span className={`tag ${TONE[condition] ?? "tag-neutral"} whitespace-nowrap`} title={t.conditionHelp[condition]}>
      {t.condition[condition] ?? condition}
      {condition === "IN_SERVICE" && backAt ? ` · ${t.backOn(formatDay(backAt, locale, { day: "numeric", month: "short" }))}` : ""}
    </span>
  );
}
