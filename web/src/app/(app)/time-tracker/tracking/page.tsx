import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getMyTimeTrackerData, getTimeTrackerCalendarData } from "@/lib/queries/timetracker";
import { formatDate, formatMinutes } from "@/lib/format";
import { getLocale, getDictionary, type Dictionary } from "@/lib/i18n";
import { RunningTimerBox } from "@/components/timetracker/RunningTimerBox";
import { EditEntryButton } from "@/components/timetracker/EditEntryButton";
import { TimeTrackerCalendar } from "@/components/timetracker/TimeTrackerCalendar";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { DateNav } from "@/components/calendar/DateNav";
import { addDays, isoDate, isoTime, mondayOf, parseIsoDate } from "@/lib/calendar";

function trackingHref(params: { view?: string }) {
  const qs = new URLSearchParams();
  if (params.view) qs.set("view", params.view);
  const s = qs.toString();
  return `/time-tracker/tracking${s ? `?${s}` : ""}`;
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
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
  const view = params.view === "list" ? "list" : "calendar";

  const defaultFrom = mondayOf(new Date());
  const from = params.from ? parseIsoDate(params.from) : defaultFrom;
  const toInclusive = params.to ? parseIsoDate(params.to) : addDays(defaultFrom, 6);
  const listData = view === "list" ? await getMyTimeTrackerData(user, from, addDays(toInclusive, 1)) : null;

  const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());
  const calendarData = view === "calendar" ? await getTimeTrackerCalendarData(user, weekStart) : null;

  const running = listData?.running ?? calendarData?.running ?? null;
  const events = listData?.events ?? calendarData?.events ?? [];
  const runningNormalized = running && running.startedAt ? { ...running, startedAt: running.startedAt } : null;

  const viewSwitch = (
    <SegmentedTabs
      active={view}
      options={[
        { value: "calendar", label: <CalendarIcon />, href: trackingHref({ view: "calendar" }), title: t.timeTracker.tracking.viewCalendar },
        { value: "list", label: <ListIcon />, href: trackingHref({ view: "list" }), title: t.timeTracker.tracking.viewList },
      ]}
    />
  );

  return (
    <div>
      {view === "calendar" && <RunningTimerBox running={runningNormalized} events={events} locale={locale} />}

      <div className={`flex items-center justify-between gap-2 flex-wrap ${view === "calendar" ? "mt-5" : ""}`}>
        <div className="heading-label !text-[12px]">{view === "list" ? t.timeTracker.tracking.myEntries : t.timeTracker.tabOverview}</div>
        {viewSwitch}
      </div>

      {view === "calendar" ? (
        <>
          <div className="mt-3">
            <DateNav
              mode="single"
              weekStartIso={isoDate(weekStart)}
              basePath="/time-tracker/tracking"
              extraQuery="view=calendar"
              todayLabel={t.timeTracker.tracking.today}
            />
          </div>
          <div className="mt-4">
            <TimeTrackerCalendar weekStart={weekStart} entries={calendarData!.entries} events={calendarData!.events} locale={locale} />
          </div>
        </>
      ) : (
        <ListView from={from} toInclusive={toInclusive} listData={listData!} t={t} locale={locale} />
      )}
    </div>
  );
}

function ListView({
  from,
  toInclusive,
  listData,
  t,
  locale,
}: {
  from: Date;
  toInclusive: Date;
  listData: NonNullable<Awaited<ReturnType<typeof getMyTimeTrackerData>>>;
  t: Dictionary;
  locale: Parameters<typeof RunningTimerBox>[0]["locale"];
}) {
  const { entries, events, running } = listData;
  const runningNormalized = running && running.startedAt ? { ...running, startedAt: running.startedAt } : null;
  const tt = t.timeTracker.tracking;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mt-3">
      <div className="md:col-span-4">
        <DateNav
          mode="range"
          fromIso={isoDate(from)}
          toIso={isoDate(toInclusive)}
          basePath="/time-tracker/tracking"
          extraQuery="view=list"
          todayLabel={tt.today}
        />

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
              {e.event ? (
                <Link href={`/events/${e.eventId}`} className="hover:text-accent">
                  {e.event.title}
                </Link>
              ) : (
                <span className="placeholder-text italic">{t.timeTracker.unassignedEvent}</span>
              )}
              <div className="placeholder-text truncate">{e.description || "—"}</div>
              <div className="font-semibold">{formatMinutes(e.minutes)}</div>
              <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase">
                <EditEntryButton
                  entry={{
                    id: e.id,
                    eventId: e.eventId,
                    date: isoDate(e.date),
                    minutes: e.minutes,
                    description: e.description,
                    phase: e.phase,
                    startTime: e.startedAt ? isoTime(e.startedAt) : undefined,
                    endTime: e.endedAt ? isoTime(e.endedAt) : undefined,
                  }}
                  events={events}
                  modalTitle={t.timeTracker.entryEdit.editEntry}
                  t={t.timeTracker.editEntryForm}
                  tPhases={t.phases}
                  tDelete={t.timeTracker.deleteEntry}
                  className="hover:text-ink placeholder-text"
                >
                  {tt.edit}
                </EditEntryButton>
              </div>
            </div>
          ))}
        </div>

        <div className="md:hidden flex flex-col gap-2 mt-4">
          {entries.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2.5 py-3 px-2.5 rounded-lg border-b border-ink/8 last:border-b-0 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="placeholder-text text-[10.5px] mb-0.5">{formatDate(e.date)}</div>
                {e.event ? (
                  <Link href={`/events/${e.eventId}`} className="font-semibold hover:text-accent">
                    {e.event.title}
                  </Link>
                ) : (
                  <span className="font-semibold placeholder-text italic">{t.timeTracker.unassignedEvent}</span>
                )}
                <div className="placeholder-text text-[11.5px] mt-0.5 truncate">{e.description || "—"}</div>
                <div className="flex gap-3 text-[9px] tracking-[0.1em] uppercase mt-1.5">
                  <EditEntryButton
                    entry={{
                      id: e.id,
                      eventId: e.eventId,
                      date: isoDate(e.date),
                      minutes: e.minutes,
                      description: e.description,
                      phase: e.phase,
                      startTime: e.startedAt ? isoTime(e.startedAt) : undefined,
                      endTime: e.endedAt ? isoTime(e.endedAt) : undefined,
                    }}
                    events={events}
                    modalTitle={t.timeTracker.entryEdit.editEntry}
                    t={t.timeTracker.editEntryForm}
                    tPhases={t.phases}
                    tDelete={t.timeTracker.deleteEntry}
                    className="hover:text-ink placeholder-text"
                  >
                    {tt.edit}
                  </EditEntryButton>
                </div>
              </div>
              <div className="font-semibold shrink-0">{formatMinutes(e.minutes)}</div>
            </div>
          ))}
        </div>

        {entries.length === 0 && <p className="text-sm placeholder-text mt-3">{tt.noEntriesInRange}</p>}
        <div className="label mt-3 px-2.5">{tt.manualTrackedNote}</div>
      </div>

      <div className="md:col-span-1 flex flex-col gap-3 order-first md:order-none">
        <RunningTimerBox running={runningNormalized} events={events} locale={locale} compact />
      </div>
    </div>
  );
}
