import Link from "next/link";
import { requireUser, canCreateEvent } from "@/lib/authz";
import { getDashboardData, getDashboardTimeline, type TimelineItem } from "@/lib/queries/dashboard";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/format";
import { EventStatusPill } from "@/components/StatusPill";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expense-categories";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { WeekNav } from "@/components/calendar/WeekNav";
import { isSameDay, mondayOf, parseIsoDate } from "@/lib/calendar";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const view = params.view === "timeline" || params.view === "calendar" ? params.view : "list";
  const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());

  const [data, timeline, calendarEvents] = await Promise.all([
    getDashboardData(user),
    view === "timeline" ? getDashboardTimeline(user) : Promise.resolve(null),
    view === "calendar" ? getWeekCalendarData(user, weekStart) : Promise.resolve(null),
  ]);
  const maxMonthly = Math.max(1, ...data.monthly.flatMap((m) => [m.income, m.expense]));

  return (
    <div>
      <div className="flex items-end justify-between border-b-2 border-ink pb-2">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {canCreateEvent(user) && (
          <Link href="/events/new" className="btn">
            New event
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pb-2.5 border-b border-ink/20 flex-wrap gap-2">
        <div className="flex border border-ink">
          <Link
            href="/dashboard"
            className={`text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 ${view === "list" ? "bg-ink text-bg" : ""}`}
          >
            List
          </Link>
          <Link
            href="/dashboard?view=timeline"
            className={`text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 border-l border-ink ${view === "timeline" ? "bg-ink text-bg" : ""}`}
          >
            Timeline
          </Link>
          <Link
            href="/dashboard?view=calendar"
            className={`text-[9px] tracking-[0.14em] uppercase px-3 py-1.5 border-l border-ink ${view === "calendar" ? "bg-ink text-bg" : ""}`}
          >
            Calendar
          </Link>
        </div>
        {view === "calendar" && <WeekNav weekStart={weekStart} hrefFor={(week) => `/dashboard?view=calendar&week=${week}`} />}
      </div>

      {view === "timeline" && timeline && (
        <div className="mt-4">
          <TimelineList items={timeline} />
        </div>
      )}
      {view === "calendar" && calendarEvents && (
        <div className="mt-3">
          <WeekCalendar weekStart={weekStart} events={calendarEvents} eventHref={(id) => `/events/${id}`} />
        </div>
      )}

      <div className="heading-label mt-4 mb-1.5">Needs attention</div>
      <div className="grid grid-cols-3 gap-px bg-ink/20 border border-ink/20">
        <AttentionTile
          label={`${data.needsAttention.overdueInvoices.count} invoice${data.needsAttention.overdueInvoices.count === 1 ? "" : "s"} overdue`}
          value={formatCurrency(data.needsAttention.overdueInvoices.total)}
          sub={
            data.needsAttention.overdueInvoices.count
              ? `oldest ${data.needsAttention.overdueInvoices.oldestDays} days`
              : "none"
          }
          attention={data.needsAttention.overdueInvoices.count > 0}
        />
        <AttentionTile
          label={`${data.needsAttention.waitingQuotes.count} quote${data.needsAttention.waitingQuotes.count === 1 ? "" : "s"} waiting`}
          value={formatCurrency(data.needsAttention.waitingQuotes.total)}
          sub={
            data.needsAttention.waitingQuotes.count
              ? `sent ${data.needsAttention.waitingQuotes.rangeDays[0]}–${data.needsAttention.waitingQuotes.rangeDays[1]} days ago`
              : "none"
          }
        />
        <AttentionTile
          label={`${data.needsAttention.eventsToInvoice.count} event${data.needsAttention.eventsToInvoice.count === 1 ? "" : "s"} to invoice`}
          value={String(data.needsAttention.eventsToInvoice.count)}
          sub={
            data.needsAttention.eventsToInvoice.first
              ? `${data.needsAttention.eventsToInvoice.first.title} — ended ${formatDateRange(data.needsAttention.eventsToInvoice.first.startDate, data.needsAttention.eventsToInvoice.first.endDate)}`
              : "none"
          }
        />
      </div>

      {view === "list" && (
        <>
          <div className="heading-label mt-5 mb-1.5">Upcoming events</div>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-sm placeholder-text">No upcoming events.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {data.upcomingEvents.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`} className="border border-ink/25 block hover:border-ink">
                  <div className="bg-ink/10 h-13" />
                  <div className="p-2.5">
                    <EventStatusPill status={event.status} />
                    <div className="text-[11px] font-semibold mt-1.5">{event.title}</div>
                    <div className="text-[9px] placeholder-text mt-0.5">
                      {event.companyName}
                      <br />
                      {formatDateRange(event.startDate, event.endDate)}
                      {event.venues[0] ? ` · ${event.venues[0].name}` : ""}
                    </div>
                    <div className="rule-thin my-1.5" />
                    <div className="flex justify-between text-[9px]">
                      <span className="heading-label">Next milestone</span>
                      <span>{event.milestones[0]?.title ?? "—"}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-4 mt-5">
        <div>
          <div className="heading-label mb-0.5">Latest expenses</div>
          {data.latestExpenses.length === 0 ? (
            <p className="text-sm placeholder-text">No expenses yet.</p>
          ) : (
            data.latestExpenses.map((exp) => (
              <div key={exp.id} className="row grid grid-cols-[1fr_auto] items-center gap-2.5 py-2 border-b border-ink/10 text-[13px]">
                <div>
                  {EXPENSE_CATEGORY_LABEL[exp.category]}{" "}
                  <span className="placeholder-text">· {exp.event?.title ?? "Company overhead"}</span>
                </div>
                <div className="placeholder-text">{formatCurrency(exp.amount)}</div>
              </div>
            ))
          )}
        </div>
        <div>
          <div className="heading-label mb-0.5">Balance</div>
          {data.monthly.length === 0 ? (
            <p className="text-sm placeholder-text">Not enough data yet.</p>
          ) : (
            <div className="flex items-end gap-3 h-14 mt-1.5">
              {data.monthly.map((m) => (
                <div key={m.label} className="flex items-end gap-1 h-full">
                  <div className="bg-ink/25 w-3" style={{ height: `${(m.income / maxMonthly) * 100}%` }} title={`Income ${formatCurrency(m.income)}`} />
                  <div className="bg-accent w-3" style={{ height: `${(m.expense / maxMonthly) * 100}%` }} title={`Expense ${formatCurrency(m.expense)}`} />
                </div>
              ))}
              <span className="heading-label ml-2">Income / expense</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineList({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="text-sm placeholder-text">Nothing on the horizon in the next 60 days.</p>;

  const groups: { date: Date; items: typeof items }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.date, item.date)) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }

  const KIND_LABEL = { build: "Build", start: "Start", milestone: "Milestone" } as const;

  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <div key={g.date.toISOString()} className="grid grid-cols-[90px_1fr] gap-3 py-2 border-b border-ink/10">
          <div className="text-[12px] font-semibold pt-0.5">{formatDate(g.date, { weekday: "short", day: "numeric", month: "short" })}</div>
          <div className="flex flex-col gap-1.5">
            {g.items.map((item, i) => (
              <Link key={i} href={`/events/${item.eventId}`} className="flex items-center gap-2 text-[13px] hover:text-accent">
                <span className="tag tag-neutral">{KIND_LABEL[item.kind]}</span>
                <span>{item.label}</span>
                <span className="placeholder-text text-[11px]">· {item.eventTitle}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AttentionTile({
  label,
  value,
  sub,
  attention,
}: {
  label: string;
  value: string;
  sub: string;
  attention?: boolean;
}) {
  return (
    <div className="bg-surface px-2.5 py-2.5">
      <div className={`heading-label ${attention ? "text-accent" : ""}`}>{label}</div>
      <div className="text-xl font-semibold tracking-tight mt-0.5">{value}</div>
      <div className="text-[9px] placeholder-text mt-0.5">{sub}</div>
    </div>
  );
}
