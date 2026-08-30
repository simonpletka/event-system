import { addDays, mondayOf, weekLabel } from "@/lib/calendar";
import type { TimePeriod } from "@/lib/queries/timetracker";

export function stepDate(period: TimePeriod, anchor: Date, dir: 1 | -1) {
  if (period === "day") return addDays(anchor, dir);
  if (period === "week") return addDays(anchor, dir * 7);
  const d = new Date(anchor);
  if (period === "year") {
    d.setFullYear(d.getFullYear() + dir);
    return d;
  }
  d.setMonth(d.getMonth() + dir);
  return d;
}

export function periodLabel(period: TimePeriod, anchor: Date) {
  if (period === "day") return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(anchor);
  if (period === "week") return weekLabel(mondayOf(anchor));
  if (period === "year") return String(anchor.getFullYear());
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(anchor);
}

export function periodNounFor(period: TimePeriod, t?: { day: string; week: string; month: string; year: string }) {
  if (t) return t[period];
  if (period === "day") return "day";
  if (period === "week") return "week";
  if (period === "year") return "year";
  return "month";
}

export function currentPeriodLabel(
  period: TimePeriod,
  t?: { todayHeading: string; thisWeekHeading: string; thisMonthHeading: string; thisYearHeading: string }
) {
  if (t) {
    if (period === "day") return t.todayHeading;
    if (period === "week") return t.thisWeekHeading;
    if (period === "year") return t.thisYearHeading;
    return t.thisMonthHeading;
  }
  if (period === "day") return "Today";
  if (period === "week") return "This week";
  if (period === "year") return "This year";
  return "This month";
}
