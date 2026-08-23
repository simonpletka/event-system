import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getMyTimeTrackerData, getTimeTrackerCalendarData, rangeStart, type TimePeriod } from "@/lib/queries/timetracker";
import { formatDate, formatMinutes } from "@/lib/format";
import { getLocale, getDictionary, type Dictionary } from "@/lib/i18n";
import { ManualEntryForm } from "@/components/timetracker/ManualEntryForm";
import { RunningTimerBox } from "@/components/timetracker/RunningTimerBox";
import { DeleteEntryButton } from "@/components/timetracker/DeleteEntryButton";
import { TimeTrackerCalendar } from "@/components/timetracker/TimeTrackerCalendar";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { WeekNav } from "@/components/calendar/WeekNav";
import { isoDate, mondayOf, parseIsoDate } from "@/lib/calendar";
import { stepDate, periodLabel, currentPeriodLabel } from "@/lib/period-nav";

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
  const locale = await getLocale();
  const t = getDictionary(locale);
  const view = params.view === "calendar" ? "calendar" : "list";
  const mode = params.mode === "manual" ? "manual" : "timer";
  const period: TimePeriod = params.period === "day" || params.period === "month" ? params.period : "week";
  const anchor = params.date ? parseIsoDate(params.date) : new Date();

  const listData = view === "list" ? await getMyTimeTrackerData(user, period, anchor) : null;
  const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());
  const calendarData = view === "calendar" ? await getTimeTrackerCalendarData(user, weekStart) : null;

  const running = listData?.running ?? calendarData?.running ?? null;
  const events = listData?.events ?? calendarData?.events ?? [];
  const runningNormalized = running && running.startedAt ? { ...running, startedAt: running.startedAt } : null;

  const viewSwitch = (
    <SegmentedTabs
      active={view}
      options={[
        { value: "list", label: t.timeTracker.tracking.viewList, href: trackingHref({ mode, period, date: params.date }) },
        { value: "calendar", label: t.timeTracker.tracking.viewCalendar, href: trackingHref({ view: "calendar" }) },
      ]}
    />
  );

  const modeOptions = [
    { value: "timer", label: t.timeTracker.tracking.modeTimer, href: trackingHref({ view, mode: "timer", period, date: params.date }) },
    { value: "manual", label: t.timeTracker.tracking.modeManual, href: trackingHref({ view, mode: "manual", period, date: params.date }) },
  ];

  return (
    <div>
      {runningNormalized ? (
        <RunningTimerBox running={runningNormalized} events={events} locale={locale} />
      ) : (
        <div>
          <div className="mb-3">
            <SegmentedTabs active={mode} options={modeOptions} />
          </div>
          {mode === "timer" ? (
            <RunningTimerBox running={null} events={events} locale={locale} />
          ) : (
            <ManualEntryForm events={events} t={t.timeTracker.manualForm} tPhases={t.phases} />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap mt-5">
        <div className="heading-label !text-[12px]">{view === "list" ? t.timeTracker.tracking.myEntries : t.timeTracker.tabOverview}</div>
        {viewSwitch}
      </div>

      {view === "calendar" ? (
        <>
          <div className="flex justify-end mt-3">
            <WeekNav weekStart={weekStart} hrefFor={(week) => `/time-tracker/tracking?view=calendar&week=${week}`} todayLabel={t.timeTracker.tracking.today} />
          </div>
          <div className="mt-4">
            <TimeTrackerCalendar weekStart={weekStart} entries={calendarData!.entries} locale={locale} />
          </div>
        </>
      ) : (
        <ListView period={period} anchor={anchor} params={params} listData={listData!} t={t} />
      )}
    </div>
  );
}

function ListView({
  period,
  anchor,
  params,
  listData,
  t,
}: {
  period: TimePeriod;
  anchor: Date;
  params: Record<string, string | undefined>;
  listData: NonNullable<Awaited<ReturnType<typeof getMyTimeTrackerData>>>;
  t: Dictionary;
}) {
  const mode = params.mode === "manual" ? "manual" : "timer";
  const { entries, periodTotals, periodTotalMinutes } = listData;
  const tt = t.timeTracker.tracking;

  const periodOptions = [
    { value: "day", label: tt.day, href: trackingHref({ mode, period: "day" }) },
    { value: "week", label: tt.week, href: trackingHref({ mode, period: "week" }) },
    { value: "month", label: tt.month, href: trackingHref({ mode, period: "month" }) },
  ];

  const prevHref = trackingHref({ mode, period, date: isoDate(stepDate(period, anchor, -1)) });
  const nextHref = trackingHref({ mode, period, date: isoDate(stepDate(period, anchor, 1)) });
  const todayHref = trackingHref({ mode, period });

  const periodNoun = tt.periodNoun[period];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5 mt-3">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
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
              {tt.today}
            </Link>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="grid grid-cols-[56px_1.2fr_1.4fr_.6fr_.5fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-4 px-2.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
            <span className="heading-label">{tt.colDate}</span>
            <span className="heading-label">{tt.colEvent}</span>
            <span className="heading-label">{tt.colWork}</span>
            <span className="heading-label">{tt.colHours}</span>
            <span className="heading-label"></span>
          </div>

          {entries.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[56px_1.2fr_1.4fr_.6fr_.5fr] gap-2.5 items-center py-3 px-2.5 rounded-lg border-b border-ink/8 last:border-b-0 text-[15px] hover:bg-ink/5"
            >
              <div className="placeholder-text">{formatDate(e.date)}</div>
              <Link href={`/events/${e.eventId}`} className="hover:text-accent">
                {e.event.title}
              </Link>
              <div className="placeholder-text truncate">{e.description || "—"}</div>
              <div className="font-semibold">{formatMinutes(e.minutes)}</div>
              <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
                <Link href={`/time-tracker/entries/${e.id}/edit`} className="hover:text-ink placeholder-text">
                  {tt.edit}
                </Link>
                <DeleteEntryButton id={e.id} t={t.timeTracker.deleteEntry} />
              </div>
            </div>
          ))}
        </div>

        <div className="md:hidden flex flex-col gap-2 mt-4">
          {entries.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2.5 py-3 px-2.5 rounded-lg border-b border-ink/8 last:border-b-0 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="placeholder-text text-[10.5px] mb-0.5">{formatDate(e.date)}</div>
                <Link href={`/events/${e.eventId}`} className="font-semibold hover:text-accent">
                  {e.event.title}
                </Link>
                <div className="placeholder-text text-[11.5px] mt-0.5 truncate">{e.description || "—"}</div>
                <div className="flex gap-3 text-[9px] tracking-[0.1em] uppercase mt-1.5">
                  <Link href={`/time-tracker/entries/${e.id}/edit`} className="hover:text-ink placeholder-text">
                    {tt.edit}
                  </Link>
                  <DeleteEntryButton id={e.id} t={t.timeTracker.deleteEntry} />
                </div>
              </div>
              <div className="font-semibold shrink-0">{formatMinutes(e.minutes)}</div>
            </div>
          ))}
        </div>

        {entries.length === 0 && <p className="text-sm placeholder-text mt-3">{tt.noEntriesForPeriod(periodNoun)}</p>}
        <div className="label mt-3 px-2.5">{tt.manualTrackedNote}</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card px-4 py-4">
          <div className="heading-label !text-[12px] mb-1.5">
            {isoDate(rangeStart(period, anchor)) === isoDate(rangeStart(period, new Date())) ? currentPeriodLabel(period, tt) : periodLabel(period, anchor)}
          </div>
          {periodTotals.map((pt) => (
            <div key={pt.title} className="flex justify-between py-1.5 text-[13px] border-b border-ink/8 last:border-b-0">
              <div>{pt.title}</div>
              <div className="placeholder-text">{formatMinutes(pt.minutes)}</div>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-1 border-t border-ink/14 text-[13px] font-semibold">
            <div>{tt.totalLabel}</div>
            <div>{formatMinutes(periodTotalMinutes)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
