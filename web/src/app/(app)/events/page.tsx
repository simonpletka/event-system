import Link from "next/link";
import { requireUser, canCreateEvent } from "@/lib/authz";
import { getEventList, type EventListFilters } from "@/lib/queries/events";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { formatCurrency, formatDateRange } from "@/lib/format";
import { EventStatusPill } from "@/components/StatusPill";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { WeekNav } from "@/components/calendar/WeekNav";
import { mondayOf, parseIsoDate } from "@/lib/calendar";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { getLocale, getDictionary, type Dictionary } from "@/lib/i18n";
import type { EventStatus } from "@/generated/prisma/enums";

const STATUSES: EventStatus[] = [
  "INQUIRY",
  "QUOTE_SENT",
  "CONFIRMED",
  "IN_PROGRESS",
  "TO_INVOICE",
  "CLOSED",
  "CANCELLED",
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const t = getDictionary(await getLocale());
  const view = params.view === "calendar" ? "calendar" : "table";

  if (view === "calendar") {
    const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());
    const events = await getWeekCalendarData(user, weekStart);

    return (
      <div>
        <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
          <ViewHeader canCreate={canCreateEvent(user)} t={t} />
          <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
            <ViewSwitch view="calendar" t={t} />
            <WeekNav weekStart={weekStart} hrefFor={(week) => `/events?view=calendar&week=${week}`} todayLabel={t.calendar.today} />
          </div>
        </div>
        <div className="mt-4">
          <WeekCalendar weekStart={weekStart} events={events} eventHref={(id) => `/events/${id}`} t={t.calendar} tStatus={t.statusEvent} />
        </div>
      </div>
    );
  }

  const filters: EventListFilters = {
    q: params.q || undefined,
    status: (params.status as EventStatus) || undefined,
    client: params.client || undefined,
    place: params.place || undefined,
  };
  const { events, total, activeCount, clients, places } = await getEventList(user, filters);
  const now = new Date();
  const firstUpcomingId = events.find((e) => e.endDate >= now)?.id;

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <ViewHeader canCreate={canCreateEvent(user)} total={total} activeCount={activeCount} t={t} />

        <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
          <ViewSwitch view="table" t={t} />

          <form method="get" className="flex gap-1.5 flex-wrap items-center">
            <select name="status" defaultValue={filters.status ?? ""} className="btno bg-transparent text-[9px]">
              <option value="">{t.events.statusFilter}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.statusEvent[s]}
                </option>
              ))}
            </select>
            <select name="client" defaultValue={filters.client ?? ""} className="btno bg-transparent text-[9px]">
              <option value="">{t.events.clientFilter}</option>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select name="place" defaultValue={filters.place ?? ""} className="btno bg-transparent text-[9px]">
              <option value="">{t.events.placeFilter}</option>
              {places.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder={t.common.search}
              className="input text-[9px] py-1.5 w-[110px]"
            />
            <button type="submit" className="btno text-[9px]">
              {t.events.apply}
            </button>
            {(filters.q || filters.status || filters.client || filters.place) && (
              <Link href="/events" className="text-[9px] placeholder-text hover:text-ink underline underline-offset-2">
                {t.events.clear}
              </Link>
            )}
          </form>
        </div>
      </div>

      <div className="grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr_.6fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5">
        <span className="heading-label">{t.events.colEvent}</span>
        <span className="heading-label">{t.events.clientFilter}</span>
        <span className="heading-label">{t.events.colDates}</span>
        <span className="heading-label">{t.events.placeFilter}</span>
        <span className="heading-label">{t.events.colStatus}</span>
        <span className="heading-label">{t.events.colValue}</span>
      </div>

      {events.length === 0 && <p className="text-sm placeholder-text mt-4">{t.events.noEventsMatch}</p>}

      {events.map((event) => (
        <Link
          key={event.id}
          id={event.id === firstUpcomingId ? "today-row" : undefined}
          href={`/events/${event.id}`}
          className="group grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr_.6fr] gap-2.5 items-center py-3 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[13px] hover:bg-ink/5"
        >
          <div className="group-hover:text-accent">
            <span className="placeholder-text text-[11px] mr-1 group-hover:!text-accent">{event.number}</span>
            <span className="font-medium">{event.title}</span>
            <div className="label group-hover:!text-accent">{event.milestones[0]?.title ?? "—"}</div>
          </div>
          <div className="placeholder-text group-hover:!text-accent">{event.companyName}</div>
          <div className="placeholder-text group-hover:!text-accent">{formatDateRange(event.startDate, event.endDate)}</div>
          <div className="placeholder-text group-hover:!text-accent">{event.venues[0]?.name ?? "—"}</div>
          <div>
            <EventStatusPill status={event.status} t={t.statusEvent} />
          </div>
          <div className="font-semibold tabular-nums group-hover:text-accent">
            {event.quotedValue ? formatCurrency(event.quotedValue) : <span className="placeholder-text font-normal">—</span>}
          </div>
        </Link>
      ))}

      <div className="flex items-center justify-between mt-4 px-3.5">
        <div className="label">{t.events.sortedBy(events.length, total)}</div>
        <a href="#today-row" className="btno text-[9px]">
          {t.events.today}
        </a>
      </div>
    </div>
  );
}

function ViewHeader({ canCreate, total, activeCount, t }: { canCreate: boolean; total?: number; activeCount?: number; t: Dictionary }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        {total !== undefined && <div className="heading-label">{t.events.headerCount(total, activeCount ?? 0)}</div>}
        <h1 className="text-[28px] font-bold tracking-tight mt-1">{t.events.title}</h1>
      </div>
      {canCreate && (
        <Link href="/events/new" className="btn font-semibold">
          {t.events.newEvent}
        </Link>
      )}
    </div>
  );
}

function ViewSwitch({ view, t }: { view: "table" | "calendar"; t: Dictionary }) {
  return (
    <SegmentedTabs
      active={view}
      options={[
        { value: "table", label: t.events.viewTable, href: "/events" },
        { value: "calendar", label: t.events.viewCalendar, href: "/events?view=calendar" },
      ]}
    />
  );
}
