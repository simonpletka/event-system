import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getMyTimeTrackerData, getTimeTrackerCalendarData, rangeStart, type TimePeriod } from "@/lib/queries/timetracker";
import { formatDate, formatMinutes } from "@/lib/format";
import { ManualEntryForm } from "@/components/timetracker/ManualEntryForm";
import { RunningTimerBox } from "@/components/timetracker/RunningTimerBox";
import { DeleteEntryButton } from "@/components/timetracker/DeleteEntryButton";
import { TimeTrackerCalendar } from "@/components/timetracker/TimeTrackerCalendar";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { WeekNav } from "@/components/calendar/WeekNav";
import { addDays, isoDate, mondayOf, parseIsoDate, weekLabel } from "@/lib/calendar";

function stepDate(period: TimePeriod, anchor: Date, dir: 1 | -1) {
  if (period === "day") return addDays(anchor, dir);
  if (period === "week") return addDays(anchor, dir * 7);
  const d = new Date(anchor);
  d.setMonth(d.getMonth() + dir);
  return d;
}

function periodLabel(period: TimePeriod, anchor: Date) {
  if (period === "day") return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(anchor);
  if (period === "week") return weekLabel(mondayOf(anchor));
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(anchor);
}

function periodNounFor(period: TimePeriod) {
  if (period === "day") return "day";
  if (period === "week") return "week";
  return "month";
}

function currentPeriodLabel(period: TimePeriod) {
  if (period === "day") return "Today";
  if (period === "week") return "This week";
  return "This month";
}

function trackingHref(params: { view?: string; mode?: string; period?: string; date?: string }) {
  const qs = new URLSearchParams();
  if (params.view) qs.set("view", params.view);
  if (params.mode) qs.set("mode", params.mode);
  if (params.period) qs.set("period", params.period);
  if (params.date) qs.set("date", params.date);
  const s = qs.toString();
  return `/time-tracker/tracking${s ? `?${s}` : ""}`;
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const view = params.view === "calendar" ? "calendar" : "list";
  const mode = params.mode === "manual" ? "manual" : "timer";
  const period: TimePeriod = params.period === "day" || params.period === "month" ? params.period : "week";
  const anchor = params.date ? parseIsoDate(params.date) : new Date();

  const viewSwitch = (
    <SegmentedTabs
      active={view}
      options={[
        { value: "list", label: "List", href: trackingHref({ mode, period, date: params.date }) },
        { value: "calendar", label: "Calendar", href: trackingHref({ view: "calendar" }) },
      ]}
    />
  );

  if (view === "calendar") {
    const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());
    const { entries } = await getTimeTrackerCalendarData(user, weekStart);

    return (
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {viewSwitch}
          <WeekNav weekStart={weekStart} hrefFor={(week) => `/time-tracker/tracking?view=calendar&week=${week}`} />
        </div>
        <div className="mt-4">
          <TimeTrackerCalendar weekStart={weekStart} entries={entries} />
        </div>
      </div>
    );
  }

  const { running, entries, periodTotals, periodTotalMinutes, events } = await getMyTimeTrackerData(user, period, anchor);
  const runningNormalized = running && running.startedAt ? { ...running, startedAt: running.startedAt } : null;

  const periodOptions = [
    { value: "day", label: "Day", href: trackingHref({ mode, period: "day" }) },
    { value: "week", label: "Week", href: trackingHref({ mode, period: "week" }) },
    { value: "month", label: "Month", href: trackingHref({ mode, period: "month" }) },
  ];
  const modeOptions = [
    { value: "timer", label: "Timer", href: trackingHref({ mode: "timer", period, date: params.date }) },
    { value: "manual", label: "Manual", href: trackingHref({ mode: "manual", period, date: params.date }) },
  ];

  const prevHref = trackingHref({ mode, period, date: isoDate(stepDate(period, anchor, -1)) });
  const nextHref = trackingHref({ mode, period, date: isoDate(stepDate(period, anchor, 1)) });
  const todayHref = trackingHref({ mode, period });

  return (
    <div>
      {runningNormalized ? (
        <RunningTimerBox running={runningNormalized} events={events} />
      ) : (
        <div>
          <div className="mb-3">
            <SegmentedTabs active={mode} options={modeOptions} />
          </div>
          {mode === "timer" ? <RunningTimerBox running={null} events={events} /> : <ManualEntryForm events={events} />}
        </div>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-5 mt-5">
        <div>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="heading-label">My entries</div>
            {viewSwitch}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <SegmentedTabs options={periodOptions} active={period} />
            <div className="flex items-center gap-1.5">
              <Link href={prevHref} className="btno px-2 py-1.5">
                ←
              </Link>
              <span className="text-[10px] tracking-[0.1em] uppercase min-w-[150px] text-center">{periodLabel(period, anchor)}</span>
              <Link href={nextHref} className="btno px-2 py-1.5">
                →
              </Link>
              <Link href={todayHref} className="btno">
                Today
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-[56px_1.2fr_1.4fr_.6fr_.5fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-4 px-2.5">
            <span className="heading-label">Date</span>
            <span className="heading-label">Event</span>
            <span className="heading-label">Work</span>
            <span className="heading-label">Hours</span>
            <span className="heading-label"></span>
          </div>

          {entries.length === 0 && <p className="text-sm placeholder-text mt-3">No entries for this {periodNounFor(period)}.</p>}

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
            <div className="heading-label mb-1.5">{isoDate(rangeStart(period, anchor)) === isoDate(rangeStart(period, new Date())) ? currentPeriodLabel(period) : periodLabel(period, anchor)}</div>
            {periodTotals.map((t) => (
              <div key={t.title} className="flex justify-between py-1.5 text-[13px] border-b border-ink/8 last:border-b-0">
                <div>{t.title}</div>
                <div className="placeholder-text">{formatMinutes(t.minutes)}</div>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-1 border-t border-ink/14 text-[13px] font-semibold">
              <div>Total</div>
              <div>{formatMinutes(periodTotalMinutes)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
