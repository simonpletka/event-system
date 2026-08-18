import { addDays, mondayOf, weekLabel } from "@/lib/calendar";
import type { TimePeriod } from "@/lib/queries/timetracker";

export function stepDate(period: TimePeriod, anchor: Date, dir: 1 | -1) {
  if (period === "day") return addDays(anchor, dir);
  if (period === "week") return addDays(anchor, dir * 7);
  const d = new Date(anchor);
  d.setMonth(d.getMonth() + dir);
  return d;
}

export function periodLabel(period: TimePeriod, anchor: Date) {
  if (period === "day") return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(anchor);
  if (period === "week") return weekLabel(mondayOf(anchor));
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(anchor);
}

export function periodNounFor(period: TimePeriod, t?: { day: string; week: string; month: string }) {
  if (t) return t[period];
  if (period === "day") return "day";
  if (period === "week") return "week";
  return "month";
}

export function currentPeriodLabel(period: TimePeriod, t?: { todayHeading: string; thisWeekHeading: string; thisMonthHeading: string }) {
  if (t) {
    if (period === "day") return t.todayHeading;
    if (period === "week") return t.thisWeekHeading;
    return t.thisMonthHeading;
  }
  if (period === "day") return "Today";
  if (period === "week") return "This week";
  return "This month";
}
