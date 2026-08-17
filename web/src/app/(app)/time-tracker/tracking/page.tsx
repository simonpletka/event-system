import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getMyTimeTrackerData } from "@/lib/queries/timetracker";
import { formatDate, formatMinutes } from "@/lib/format";
import { deleteTimeEntryAction } from "@/lib/actions/timetracker";
import { ManualEntryForm } from "@/components/timetracker/ManualEntryForm";
import { RunningTimerBox } from "@/components/timetracker/RunningTimerBox";

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

  return (
    <div>
      <div className="flex justify-between items-end mb-3">
        <div className="label">
          Week {isoWeek(new Date())} · {formatMinutes(weekTotalMinutes)} logged
        </div>
      </div>

      <RunningTimerBox running={running && running.startedAt ? { ...running, startedAt: running.startedAt } : null} events={events} />

      <div className="grid grid-cols-[1fr_250px] gap-4 mt-4">
        <div>
          <div className="flex justify-between items-center">
            <div className="label">My entries</div>
            <div className="flex border border-ink">
              {(["day", "week", "month"] as const).map((p) => (
                <Link
                  key={p}
                  href={`/time-tracker/tracking?period=${p}`}
                  className={`text-[9px] tracking-[0.14em] uppercase px-2 py-1 ${period === p ? "bg-ink text-bg" : ""}`}
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[56px_1.2fr_1.4fr_.6fr_.5fr] gap-2.5 border-b-2 border-ink pb-1.5 mt-2">
            <span className="heading-label">Date</span>
            <span className="heading-label">Event</span>
            <span className="heading-label">Work</span>
            <span className="heading-label">Hours</span>
            <span className="heading-label"></span>
          </div>

          {entries.length === 0 && <p className="text-sm placeholder-text mt-3">No entries for this period.</p>}

          {entries.map((e) => (
            <div key={e.id} className="grid grid-cols-[56px_1.2fr_1.4fr_.6fr_.5fr] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px]">
              <div className="placeholder-text">{formatDate(e.date)}</div>
              <Link href={`/events/${e.eventId}`} className="hover:text-accent">
                {e.event.title}
              </Link>
              <div className="placeholder-text truncate">{e.description || "—"}</div>
              <div>{formatMinutes(e.minutes)}</div>
              <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
                <Link href={`/time-tracker/entries/${e.id}/edit`} className="hover:text-ink placeholder-text">
                  Edit
                </Link>
                <form action={deleteTimeEntryAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className="placeholder-text hover:text-accent">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
          <div className="label mt-2">Manual and tracked entries look identical in every report.</div>
        </div>

        <div className="border-l border-ink/20 pl-3">
          <ManualEntryForm events={events} />
          <div className="rule-thin my-3" />
          <div className="label mb-1">This week</div>
          {weekTotals.map((t) => (
            <div key={t.title} className="flex justify-between py-1 text-[13px]">
              <div>{t.title}</div>
              <div className="placeholder-text">{formatMinutes(t.minutes)}</div>
            </div>
          ))}
          <div className="flex justify-between py-1.5 text-[13px] font-semibold border-t border-ink/20 mt-1 pt-1.5">
            <div>Total</div>
            <div>{formatMinutes(weekTotalMinutes)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
