import Link from "next/link";
import { requireUser, canCreateEvent } from "@/lib/authz";
import { getDashboardData, getDashboardTimeline, type TimelineItem } from "@/lib/queries/dashboard";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { formatCurrency, formatCompactCurrency, formatDate, formatDateRange, niceAxisMax } from "@/lib/format";
import { EventStatusPill } from "@/components/StatusPill";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { WeekNav } from "@/components/calendar/WeekNav";
import { isSameDay, mondayOf, parseIsoDate } from "@/lib/calendar";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { ChartAxisGrid } from "@/components/ui/ChartAxisGrid";
import { INCOME_CHART_COLOR } from "@/lib/chart-colors";
import { getLocale, getDictionary, type Dictionary } from "@/lib/i18n";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const view = params.view === "timeline" || params.view === "calendar" ? params.view : "list";
  const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());

  const [data, timeline, calendarEvents] = await Promise.all([
    getDashboardData(user),
    view === "timeline" ? getDashboardTimeline(user) : Promise.resolve(null),
    view === "calendar" ? getWeekCalendarData(user, weekStart) : Promise.resolve(null),
  ]);
  const maxMonthly = Math.max(1, ...data.monthly.flatMap((m) => [m.income, m.expense]));
  const axisMax = niceAxisMax(maxMonthly);
  const axisTicks = [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0].map((v) => formatCompactCurrency(v));

  const viewOptions = [
    { value: "list", label: t.dashboard.viewList, href: "/dashboard" },
    { value: "timeline", label: t.dashboard.viewTimeline, href: "/dashboard?view=timeline" },
    { value: "calendar", label: t.dashboard.viewCalendar, href: "/dashboard?view=calendar" },
  ];

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 mt-0 md:-mt-5 px-6 pt-5 pb-4 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <div className="flex items-end justify-between">
          <h1 className="text-[28px] font-bold tracking-tight">{t.dashboard.title}</h1>
          {canCreateEvent(user) && (
            <Link href="/events/new" className="btn font-semibold">
              {t.dashboard.newEvent}
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <SegmentedTabs options={viewOptions} active={view} />
          {view === "calendar" && (
            <WeekNav weekStart={weekStart} hrefFor={(week) => `/dashboard?view=calendar&week=${week}`} todayLabel={t.calendar.today} />
          )}
        </div>
      </div>

      {view === "timeline" && timeline && (
        <div className="mt-5">
          <TimelineList items={timeline} t={t} />
        </div>
      )}
      {view === "calendar" && calendarEvents && (
        <div className="mt-4">
          <WeekCalendar weekStart={weekStart} events={calendarEvents} locale={locale} />
        </div>
      )}

      <div className="heading-label mt-6 mb-2.5">{t.dashboard.needsAttention}</div>
      <div className="flex overflow-x-auto gap-3 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
        <AttentionTile
          icon={ICON_ALERT}
          label={t.dashboard.invoiceOverdue(data.needsAttention.overdueInvoices.count)}
          value={formatCurrency(data.needsAttention.overdueInvoices.total)}
          sub={
            data.needsAttention.overdueInvoices.count
              ? t.dashboard.oldestDays(data.needsAttention.overdueInvoices.oldestDays)
              : t.dashboard.none
          }
          attention={data.needsAttention.overdueInvoices.count > 0}
        />
        <AttentionTile
          icon={ICON_SEND}
          label={t.dashboard.quoteWaiting(data.needsAttention.waitingQuotes.count)}
          value={formatCurrency(data.needsAttention.waitingQuotes.total)}
          sub={
            data.needsAttention.waitingQuotes.count
              ? t.dashboard.sentDaysAgo(data.needsAttention.waitingQuotes.rangeDays[0], data.needsAttention.waitingQuotes.rangeDays[1])
              : t.dashboard.none
          }
        />
        <AttentionTile
          icon={ICON_INVOICE}
          label={t.dashboard.eventToInvoice(data.needsAttention.eventsToInvoice.count)}
          value={String(data.needsAttention.eventsToInvoice.count)}
          sub={
            data.needsAttention.eventsToInvoice.first
              ? t.dashboard.eventEnded(
                  data.needsAttention.eventsToInvoice.first.title,
                  formatDateRange(data.needsAttention.eventsToInvoice.first.startDate, data.needsAttention.eventsToInvoice.first.endDate)
                )
              : t.dashboard.none
          }
        />
      </div>

      {view === "list" && (
        <>
          <div className="flex items-baseline justify-between mt-7 mb-2.5">
            <div className="heading-label">{t.dashboard.upcomingEvents}</div>
          </div>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-sm placeholder-text">{t.dashboard.noUpcomingEvents}</p>
          ) : (
            <div className="flex overflow-x-auto gap-3 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
              {data.upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="card block overflow-hidden hover:border-ink/35 transition-colors shrink-0 w-[240px] md:w-auto"
                >
                  <div className="p-4 flex flex-col gap-2.5">
                    <EventStatusPill status={event.status} t={t.statusEvent} />
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
                    <span className="heading-label">{t.dashboard.nextMilestone}</span>
                    <span className="text-ink/75">{event.milestones[0]?.title ?? "—"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-7">
        <div className="card px-5 py-4">
          <div className="heading-label mb-1.5">{t.dashboard.latestExpenses}</div>
          {data.latestExpenses.length === 0 ? (
            <p className="text-sm placeholder-text">{t.dashboard.noExpensesYet}</p>
          ) : (
            data.latestExpenses.map((exp) => (
              <div key={exp.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 py-2.5 border-b border-ink/8 last:border-b-0 text-[13px]">
                <div>
                  {t.expenseCategories[exp.category]}{" "}
                  <span className="placeholder-text">· {exp.event?.title ?? t.dashboard.companyOverhead}</span>
                </div>
                <div className="font-semibold tabular-nums">{formatCurrency(exp.amount)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="card px-6 py-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="heading-label">{t.dashboard.balance}</div>
              {data.monthly.length > 0 && (
                <div className="text-[12.5px] placeholder-text mt-1">{t.dashboard.balanceSubtitle(data.monthly.length)}</div>
              )}
            </div>
            <div className="flex gap-4 text-[12px] text-ink/70">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: INCOME_CHART_COLOR }} /> {t.dashboard.income}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent" /> {t.dashboard.expense}
              </span>
            </div>
          </div>

          {data.monthly.length === 0 ? (
            <p className="text-sm placeholder-text mt-3">{t.dashboard.notEnoughData}</p>
          ) : (
            <>
              <div className="relative h-56 mt-6">
                <ChartAxisGrid ticks={axisTicks} />
                <div className="absolute left-[74px] right-1 top-0 bottom-0 flex items-end justify-between gap-1.5">
                  {data.monthly.map((m, i) => {
                    const isLast = i === data.monthly.length - 1;
                    return (
                      <div key={m.label} className="flex items-end gap-1.5" style={{ height: 224 }}>
                        <div className="flex flex-col items-center justify-end" style={{ height: "100%" }}>
                          {isLast && (
                            <span className="text-[10.5px] font-semibold tabular-nums text-ink whitespace-nowrap mb-1">
                              {formatCurrency(m.income)}
                            </span>
                          )}
                          <div
                            className="w-4 rounded-t"
                            style={{ height: `${(m.income / axisMax) * 100}%`, background: INCOME_CHART_COLOR }}
                            title={t.dashboard.incomeAmount(formatCurrency(m.income))}
                          />
                        </div>
                        <div className="flex flex-col items-center justify-end" style={{ height: "100%" }}>
                          {isLast && (
                            <span className="text-[10.5px] font-semibold tabular-nums text-ink whitespace-nowrap mb-1">
                              {formatCurrency(m.expense)}
                            </span>
                          )}
                          <div
                            className="w-4 rounded-t bg-accent"
                            style={{ height: `${(m.expense / axisMax) * 100}%` }}
                            title={t.dashboard.expenseAmount(formatCurrency(m.expense))}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex ml-[74px] mr-1 justify-between mt-2.5">
                {data.monthly.map((m, i) => (
                  <span
                    key={m.label}
                    className={`text-[11.5px] flex-1 text-center ${i === data.monthly.length - 1 ? "font-semibold text-ink" : "placeholder-text"}`}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineList({ items, t }: { items: TimelineItem[]; t: Dictionary }) {
  if (items.length === 0) return <p className="text-sm placeholder-text">{t.dashboard.nothingOnHorizon}</p>;

  const groups: { date: Date; items: typeof items }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.date, item.date)) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }

  const KIND_LABEL = { build: t.dashboard.timelineBuild, start: t.dashboard.timelineStart, milestone: t.dashboard.timelineMilestone } as const;

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
    <div
      className={`card relative overflow-hidden px-5 py-5 flex flex-col gap-3 shrink-0 w-[160px] md:w-auto ${attention ? "border-warning/30" : ""}`}
    >
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
