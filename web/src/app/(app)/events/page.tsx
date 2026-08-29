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
import { MobileListRow } from "@/components/ui/MobileListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FilterSearch } from "@/components/ui/FilterSearch";
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
  const locale = await getLocale();
  const t = getDictionary(locale);
  const view = params.view === "calendar" ? "calendar" : "table";

  if (view === "calendar") {
    const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());
    const events = await getWeekCalendarData(user, weekStart);

    return (
      <div>
        <div className="sticky top-0 z-20 -mx-6 mt-0 md:-mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
          <ViewHeader canCreate={canCreateEvent(user)} t={t} />
          <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
            <ViewSwitch view="calendar" t={t} />
            <WeekNav weekStart={weekStart} hrefFor={(week) => `/events?view=calendar&week=${week}`} todayLabel={t.calendar.today} />
          </div>
        </div>
        <div className="mt-4">
          <WeekCalendar weekStart={weekStart} events={events} locale={locale} />
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
  const eventParams = { status: filters.status, client: filters.client, place: filters.place, q: filters.q };

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 mt-0 md:-mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <ViewHeader canCreate={canCreateEvent(user)} total={total} activeCount={activeCount} t={t} />

        <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <ViewSwitch view="table" t={t} />
            {firstUpcomingId && (
              <a href="#today-row" className="btno text-[9px]">
                {t.events.today}
              </a>
            )}
          </div>

          <div className="flex gap-1.5 items-center flex-nowrap overflow-x-auto pb-1 md:pb-0 md:flex-wrap md:overflow-visible">
            <FilterSelect
              label={t.events.statusFilter}
              value={filters.status ?? ""}
              options={STATUSES.map((s) => ({ value: s, label: t.statusEvent[s] }))}
              basePath="/events"
              params={eventParams}
              paramName="status"
              anyLabel={t.events.anyStatus}
            />
            <FilterSelect
              label={t.events.clientFilter}
              value={filters.client ?? ""}
              options={clients.map((c) => ({ value: c, label: c }))}
              basePath="/events"
              params={eventParams}
              paramName="client"
              searchable
              searchPlaceholder={t.events.searchClients}
              emptyLabel={t.events.filterNoMatches}
              anyLabel={t.events.anyClient}
            />
            <FilterSelect
              label={t.events.placeFilter}
              value={filters.place ?? ""}
              options={places.map((p) => ({ value: p, label: p }))}
              basePath="/events"
              params={eventParams}
              paramName="place"
              searchable
              searchPlaceholder={t.events.searchPlaces}
              emptyLabel={t.events.filterNoMatches}
              anyLabel={t.events.anyPlace}
            />
            <FilterSearch value={filters.q ?? ""} basePath="/events" params={eventParams} placeholder={t.common.search} />
            {(filters.q || filters.status || filters.client || filters.place) && (
              <Link href="/events" className="text-[9px] placeholder-text hover:text-ink underline underline-offset-2 shrink-0">
                {t.events.clear}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr_.6fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
          <span className="heading-label">{t.events.colEvent}</span>
          <span className="heading-label">{t.events.clientFilter}</span>
          <span className="heading-label">{t.events.colDates}</span>
          <span className="heading-label">{t.events.placeFilter}</span>
          <span className="heading-label">{t.events.colStatus}</span>
          <span className="heading-label">{t.events.colValue}</span>
        </div>

        {events.map((event) => (
          <Link
            key={event.id}
            id={event.id === firstUpcomingId ? "today-row" : undefined}
            href={`/events/${event.id}`}
            className="group grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr_.6fr] gap-2.5 items-center py-3.5 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[15px] hover:bg-ink/5"
          >
            <div className="group-hover:text-accent">
              <span className="placeholder-text text-[11px] mr-1 group-hover:!text-accent">{event.number}</span>
              <span className="text-[17px] font-semibold">{event.title}</span>
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
      </div>

      <div className="md:hidden flex flex-col gap-2 mt-4">
        {events.map((event) => (
          <MobileListRow
            key={event.id}
            href={`/events/${event.id}`}
            subLeft={event.number}
            title={event.title}
            tag={<EventStatusPill status={event.status} t={t.statusEvent} />}
            meta={`${event.companyName} · ${formatDateRange(event.startDate, event.endDate)} · ${event.venues[0]?.name ?? "—"}`}
            trailing={event.quotedValue ? formatCurrency(event.quotedValue) : "—"}
          />
        ))}
      </div>

      {events.length === 0 && (
        <EmptyState
          message={t.events.noEventsMatch}
          actionLabel={canCreateEvent(user) && !(filters.q || filters.status || filters.client || filters.place) ? t.events.newEvent : undefined}
          actionHref="/events/new"
        />
      )}

      <div className="mt-4 px-3.5">
        <div className="label">{t.events.sortedBy(events.length, total)}</div>
      </div>
    </div>
  );
}

function ViewHeader({ canCreate, total, activeCount, t }: { canCreate: boolean; total?: number; activeCount?: number; t: Dictionary }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        {/* Keep the line's height in both views so the switcher below doesn't jump
            when toggling table <-> calendar (calendar has no count to show). */}
        <div className="heading-label">{total !== undefined ? t.events.headerCount(total, activeCount ?? 0) : " "}</div>
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
      animated={false}
      options={[
        { value: "table", label: t.events.viewTable, href: "/events" },
        { value: "calendar", label: t.events.viewCalendar, href: "/events?view=calendar" },
      ]}
    />
  );
}
