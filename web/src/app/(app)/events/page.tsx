import Link from "next/link";
import { requireUser, canCreateEvent } from "@/lib/authz";
import { getEventList, type EventListFilters } from "@/lib/queries/events";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { formatCurrency, formatDateRange } from "@/lib/format";
import { EventStatusPill } from "@/components/StatusPill";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { WeekNav } from "@/components/calendar/WeekNav";
import { mondayOf, parseIsoDate } from "@/lib/calendar";
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
  const view = params.view === "calendar" ? "calendar" : "table";

  if (view === "calendar") {
    const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());
    const events = await getWeekCalendarData(user, weekStart);

    return (
      <div>
        <ViewHeader canCreate={canCreateEvent(user)} />
        <div className="flex items-center justify-between gap-2 mt-3 pb-2.5 border-b border-ink/20 flex-wrap">
          <ViewSwitch view="calendar" />
          <WeekNav weekStart={weekStart} hrefFor={(week) => `/events?view=calendar&week=${week}`} />
        </div>
        <div className="mt-2">
          <WeekCalendar weekStart={weekStart} events={events} eventHref={(id) => `/events/${id}`} />
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
      <ViewHeader canCreate={canCreateEvent(user)} total={total} activeCount={activeCount} />

      <div className="flex items-center justify-between gap-2 mt-3 pb-2.5 border-b border-ink/20 flex-wrap">
        <ViewSwitch view="table" />

        <form method="get" className="flex gap-1.5 flex-wrap items-center">
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="btno bg-transparent text-[9px]"
          >
            <option value="">Status ▾</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <select name="client" defaultValue={filters.client ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">Client ▾</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="place" defaultValue={filters.place ?? ""} className="btno bg-transparent text-[9px]">
            <option value="">Place ▾</option>
            {places.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search…"
            className="border border-ink/35 bg-transparent px-2 py-1.5 text-[9px] w-[110px]"
          />
          <button type="submit" className="btno text-[9px]">
            Apply
          </button>
          {(filters.q || filters.status || filters.client || filters.place) && (
            <Link href="/events" className="text-[9px] placeholder-text hover:text-ink underline underline-offset-2">
              Clear
            </Link>
          )}
        </form>
      </div>

      <div className="grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr_.6fr] gap-2.5 border-b-2 border-ink pb-1.5 mt-1.5">
        <span className="heading-label">Event</span>
        <span className="heading-label">Client</span>
        <span className="heading-label">Dates ↑</span>
        <span className="heading-label">Place</span>
        <span className="heading-label">Status</span>
        <span className="heading-label">Value</span>
      </div>

      {events.length === 0 && <p className="text-sm placeholder-text mt-4">No events match these filters.</p>}

      {events.map((event) => (
        <Link
          key={event.id}
          id={event.id === firstUpcomingId ? "today-row" : undefined}
          href={`/events/${event.id}`}
          className="grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr_.6fr] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px] hover:bg-ink/5"
        >
          <div>
            <span className="placeholder-text text-[11px] mr-1">{event.number}</span>
            {event.title}
            <div className="label">{event.milestones[0]?.title ?? "—"}</div>
          </div>
          <div className="placeholder-text">{event.companyName}</div>
          <div className="placeholder-text">{formatDateRange(event.startDate, event.endDate)}</div>
          <div className="placeholder-text">{event.venues[0]?.name ?? "—"}</div>
          <div>
            <EventStatusPill status={event.status} />
          </div>
          <div className="placeholder-text">{event.quotedValue ? formatCurrency(event.quotedValue) : "—"}</div>
        </Link>
      ))}

      <div className="flex items-center justify-between mt-3">
        <div className="label">
          Sorted by date — nearest first · showing {events.length} of {total}
        </div>
        <a href="#today-row" className="btno text-[9px]">
          Today
        </a>
      </div>
    </div>
  );
}

function ViewHeader({ canCreate, total, activeCount }: { canCreate: boolean; total?: number; activeCount?: number }) {
  return (
    <div className="flex items-end justify-between border-b-2 border-ink pb-2">
      <div>
        {total !== undefined && (
          <div className="heading-label">
            {total} events · {activeCount} active
          </div>
        )}
        <h1 className="text-xl font-semibold">Events</h1>
      </div>
      {canCreate && (
        <Link href="/events/new" className="btn">
          New event
        </Link>
      )}
    </div>
  );
}

function ViewSwitch({ view }: { view: "table" | "calendar" }) {
  return (
    <div className="flex border border-ink">
      <Link
        href="/events"
        className={`text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 ${view === "table" ? "bg-ink text-bg" : ""}`}
      >
        Table
      </Link>
      <Link
        href="/events?view=calendar"
        className={`text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 border-l border-ink ${view === "calendar" ? "bg-ink text-bg" : ""}`}
      >
        Calendar
      </Link>
    </div>
  );
}
