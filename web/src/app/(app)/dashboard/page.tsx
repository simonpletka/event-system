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
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

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

  const viewOptions = [
    { value: "list", label: "List", href: "/dashboard" },
    { value: "timeline", label: "Timeline", href: "/dashboard?view=timeline" },
    { value: "calendar", label: "Calendar", href: "/dashboard?view=calendar" },
  ];

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <div className="flex items-end justify-between">
          <h1 className="text-[28px] font-bold tracking-tight">Dashboard</h1>
          {canCreateEvent(user) && (
            <Link href="/events/new" className="btn">
              New event
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <SegmentedTabs options={viewOptions} active={view} />
          {view === "calendar" && <WeekNav weekStart={weekStart} hrefFor={(week) => `/dashboard?view=calendar&week=${week}`} />}
        </div>
      </div>

      {view === "timeline" && timeline && (
        <div className="mt-5">
          <TimelineList items={timeline} />
        </div>
      )}
      {view === "calendar" && calendarEvents && (
        <div className="mt-4">
          <WeekCalendar weekStart={weekStart} events={calendarEvents} eventHref={(id) => `/events/${id}`} />
        </div>
      )}

      <div className="heading-label mt-6 mb-2.5">Needs attention</div>
      <div className="grid grid-cols-3 gap-3">
        <AttentionTile
          icon={ICON_ALERT}
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
          icon={ICON_SEND}
          label={`${data.needsAttention.waitingQuotes.count} quote${data.needsAttention.waitingQuotes.count === 1 ? "" : "s"} waiting`}
          value={formatCurrency(data.needsAttention.waitingQuotes.total)}
          sub={
            data.needsAttention.waitingQuotes.count
              ? `sent ${data.needsAttention.waitingQuotes.rangeDays[0]}–${data.needsAttention.waitingQuotes.rangeDays[1]} days ago`
              : "none"
          }
        />
        <AttentionTile
          icon={ICON_INVOICE}
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
          <div className="flex items-baseline justify-between mt-7 mb-2.5">
            <div className="heading-label">Upcoming events</div>
          </div>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-sm placeholder-text">No upcoming events.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {data.upcomingEvents.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`} className="card block overflow-hidden hover:border-ink/35 transition-colors">
                  <div className="p-4 flex flex-col gap-2.5">
                    <EventStatusPill status={event.status} />
                    <div className="text-[15px] font-semibold">{event.title}</div>
                    <div className="text-[12px] placeholder-text leading-relaxed">
                      {event.companyName}
                      <br />
                      {formatDateRange(event.startDate, event.endDate)}
                      {event.venues[0] ? ` · ${event.venues[0].name}` : ""}
                    </div>
                  </div>
                  <div className="h-px bg-ink/10" />
                  <div className="flex justify-between items-center px-4 py-2.5 text-[11px]">
                    <span className="heading-label">Next milestone</span>
                    <span className="text-ink/75">{event.milestones[0]?.title ?? "—"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3 mt-7">
        <div className="card px-5 py-4">
          <div className="heading-label mb-1.5">Latest expenses</div>
          {data.latestExpenses.length === 0 ? (
            <p className="text-sm placeholder-text">No expenses yet.</p>
          ) : (
            data.latestExpenses.map((exp) => (
              <div key={exp.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 py-2.5 border-b border-ink/8 last:border-b-0 text-[13px]">
                <div>
                  {EXPENSE_CATEGORY_LABEL[exp.category]}{" "}
                  <span className="placeholder-text">· {exp.event?.title ?? "Company overhead"}</span>
                </div>
                <div className="font-semibold tabular-nums">{formatCurrency(exp.amount)}</div>
              </div>
            ))
          )}
        </div>
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between">
            <div className="heading-label">Balance</div>
            <div className="flex gap-3 text-[10px] text-ink/55">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-ink/35" /> Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-accent" /> Expense
              </span>
            </div>
          </div>
          {data.monthly.length === 0 ? (
            <p className="text-sm placeholder-text mt-1.5">Not enough data yet.</p>
          ) : (
            <div className="flex items-end gap-4 h-20 mt-3">
              {data.monthly.map((m) => (
                <div key={m.label} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="flex items-end gap-1 h-16">
                    <div
                      className="w-3 rounded-t bg-gradient-to-b from-ink/55 to-ink/15"
                      style={{ height: `${(m.income / maxMonthly) * 100}%` }}
                      title={`Income ${formatCurrency(m.income)}`}
                    />
                    <div
                      className="w-3 rounded-t bg-gradient-to-b from-[#ff5a37] to-accent"
                      style={{ height: `${(m.expense / maxMonthly) * 100}%` }}
                      title={`Expense ${formatCurrency(m.expense)}`}
                    />
                  </div>
                  <span className="text-[10px] placeholder-text">{m.label}</span>
                </div>
              ))}
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

const ICON_ALERT = "M12 9v4M12 17h.01M10.3 3.9 2.6 18a1.8 1.8 0 0 0 1.6 2.7h15.6a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z";
const ICON_SEND = "M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z";
const ICON_INVOICE = "M8 2v4M16 2v4M3 9.5h18M9 14.5h6M12 12v5";

function AttentionTile({
  icon,
  label,
  value,
  sub,
  attention,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  attention?: boolean;
}) {
  return (
    <div className={`card relative overflow-hidden px-5 py-5 flex flex-col gap-3 ${attention ? "border-warning/30" : ""}`}>
      {attention && <div className="absolute top-0 left-0 right-0 h-0.5 bg-warning" />}
      <div
        className={`w-8 h-8 rounded-[10px] border flex items-center justify-center ${
          attention ? "bg-warning/15 border-warning/30 text-warning" : "bg-ink/6 border-ink/12 text-ink/70"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={icon} />
        </svg>
      </div>
      <div className={`heading-label ${attention ? "text-warning" : ""}`}>{label}</div>
      <div className={`text-[32px] font-semibold tracking-tight -mt-1.5 ${attention ? "text-warning" : ""}`}>{value}</div>
      <div className="text-[11px] placeholder-text -mt-1.5">{sub}</div>
    </div>
  );
}
