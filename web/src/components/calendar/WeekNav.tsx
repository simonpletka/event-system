import Link from "next/link";
import { addDays, isoDate, mondayOf, weekLabel } from "@/lib/calendar";

export function WeekNav({ weekStart, hrefFor, todayLabel = "Today" }: { weekStart: Date; hrefFor: (weekIso: string) => string; todayLabel?: string }) {
  const prev = isoDate(addDays(weekStart, -7));
  const next = isoDate(addDays(weekStart, 7));
  const today = isoDate(mondayOf(new Date()));

  return (
    <div className="flex items-center gap-1.5">
      <Link href={hrefFor(prev)} className="btno px-2 py-1.5">
        ←
      </Link>
      <span className="text-[10px] tracking-[0.1em] uppercase min-w-[150px] text-center">{weekLabel(weekStart)}</span>
      <Link href={hrefFor(next)} className="btno px-2 py-1.5">
        →
      </Link>
      <Link href={hrefFor(today)} className="btno">
        {todayLabel}
      </Link>
    </div>
  );
}
