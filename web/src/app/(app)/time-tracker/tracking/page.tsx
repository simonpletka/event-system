import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getMyTimeTrackerData } from "@/lib/queries/timetracker";
import { formatDate, formatMinutes } from "@/lib/format";
import { ManualEntryForm } from "@/components/timetracker/ManualEntryForm";
import { RunningTimerBox } from "@/components/timetracker/RunningTimerBox";
import { DeleteEntryButton } from "@/components/timetracker/DeleteEntryButton";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

function isoWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return week;
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const period = (params.period as "day" | "week" | "month") || "week";
  const { running, entries, weekTotals, weekTotalMinutes, events } = await getMyTimeTrackerData(user, period);

  const periodOptions = [
    { value: "day", label: "Day", href: "/time-tracker/tracking?period=day" },
    { value: "week", label: "Week", href: "/time-tracker/tracking?period=week" },
    { value: "month", label: "Month", href: "/time-tracker/tracking?period=month" },
  ];

  return (
    <div>
      <div className="heading-label mb-3">
        Week {isoWeek(new Date())} · {formatMinutes(weekTotalMinutes)} logged
      </div>

      <RunningTimerBox running={running && running.startedAt ? { ...running, startedAt: running.startedAt } : null} events={events} />

      <div className="grid grid-cols-[1fr_280px] gap-5 mt-5">
        <div>
          <div className="flex justify-between items-center">
            <div className="heading-label">My entries</div>
            <SegmentedTabs options={periodOptions} active={period} />
          </div>

          <div className="grid grid-cols-[56px_1.2fr_1.4fr_.6fr_.5fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-4 px-2.5">
            <span className="heading-label">Date</span>
            <span className="heading-label">Event</span>
            <span className="heading-label">Work</span>
            <span className="heading-label">Hours</span>
            <span className="heading-label"></span>
          </div>

          {entries.length === 0 && <p className="text-sm placeholder-text mt-3">No entries for this period.</p>}

          {entries.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[56px_1.2fr_1.4fr_.6fr_.5fr] gap-2.5 items-center py-2.5 px-2.5 rounded-lg border-b border-ink/8 last:border-b-0 text-[13px] hover:bg-ink/5"
            >
              <div className="placeholder-text">{formatDate(e.date)}</div>
              <Link href={`/events/${e.eventId}`} className="hover:text-accent">
                {e.event.title}
              </Link>
              <div className="placeholder-text truncate">{e.description || "—"}</div>
              <div className="font-semibold">{formatMinutes(e.minutes)}</div>
              <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
                <Link href={`/time-tracker/entries/${e.id}/edit`} className="hover:text-ink placeholder-text">
                  Edit
                </Link>
                <DeleteEntryButton id={e.id} />
              </div>
            </div>
          ))}
          <div className="label mt-3 px-2.5">Manual and tracked entries look identical in every report.</div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="card px-4 py-4">
            <ManualEntryForm events={events} />
          </div>
          <div className="card px-4 py-4">
            <div className="heading-label mb-1.5">This week</div>
            {weekTotals.map((t) => (
              <div key={t.title} className="flex justify-between py-1.5 text-[13px] border-b border-ink/8 last:border-b-0">
                <div>{t.title}</div>
                <div className="placeholder-text">{formatMinutes(t.minutes)}</div>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-1 border-t border-ink/14 text-[13px] font-semibold">
              <div>Total</div>
              <div>{formatMinutes(weekTotalMinutes)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
