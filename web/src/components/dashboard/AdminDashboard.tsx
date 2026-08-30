import { getAdminDashboard } from "@/lib/queries/dashboard";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { getDictionary, type Locale } from "@/lib/i18n";
import { formatCurrency, formatDateRange } from "@/lib/format";
import { mondayOf, parseIsoDate } from "@/lib/calendar";
import type { SessionUser } from "@/lib/authz";
import { DashboardShell, NewEventAction } from "./DashboardShell";
import {
  SectionHeading,
  StatRow,
  StatTile,
  EventCard,
  EventCardGrid,
  CashflowPanel,
  ExpenseList,
  EmptyState,
  type DashEventCard,
} from "./widgets";

export async function AdminDashboard({
  user,
  locale,
  params,
}: {
  user: SessionUser;
  locale: Locale;
  params: Record<string, string | undefined>;
}) {
  const t = getDictionary(locale);
  const td = t.dashboard;
  const view = params.view === "calendar" ? "calendar" : "list";
  const weekStart = mondayOf(params.week ? parseIsoDate(params.week) : new Date());

  const [d, calendarEvents] = await Promise.all([
    getAdminDashboard(user),
    view === "calendar" ? getWeekCalendarData(user, weekStart) : Promise.resolve(null),
  ]);

  const cards: DashEventCard[] = d.upcoming.map((e) => ({
    id: e.id,
    title: e.title,
    company: e.companyName,
    status: e.status,
    start: e.startDate,
    end: e.endDate,
    venue: e.venues[0]?.name ?? null,
    nextTitle: e.roadmapItems[0]?.title ?? null,
  }));

  return (
    <DashboardShell
      title={td.title}
      action={<NewEventAction label={td.newEvent} />}
      view={view}
      weekStart={weekStart}
      weekHrefBase="/dashboard"
      todayLabel={t.calendar.today}
      listLabel={td.viewList}
      calendarLabel={td.viewCalendar}
    >
      <div>
        <SectionHeading label={td.whereThingsStand} sub={td.acrossEveryEvent} />
        <StatRow>
          <StatTile
            label={td.activeEvents}
            value={String(d.activeEvents)}
            sub={d.endingThisMonth > 0 ? td.wrappingThisMonth(d.endingThisMonth) : undefined}
            href="/events"
          />
          <StatTile
            label={td.overdueInvoicesLabel}
            value={formatCurrency(d.overdue.total)}
            sub={d.overdue.count ? td.invoicesOldest(d.overdue.count, d.overdue.oldestDays) : td.nothingWaiting}
            warn={d.overdue.count > 0}
            href="/finance/invoices?bucket=overdue"
          />
          <StatTile
            label={td.quotesAwaiting}
            value={formatCurrency(d.quotes.total)}
            sub={
              d.quotes.count
                ? td.quotesSentRange(d.quotes.count, d.quotes.rangeDays[0], d.quotes.rangeDays[1])
                : td.nothingWaiting
            }
            href="/finance/quotes?status=SENT"
          />
          <StatTile
            label={td.readyToInvoice}
            value={String(d.toInvoice.length)}
            sub={
              d.toInvoice[0]
                ? td.eventEnded(d.toInvoice[0].title, formatDateRange(d.toInvoice[0].startDate, d.toInvoice[0].endDate))
                : td.nothingWaiting
            }
            href="/events?status=TO_INVOICE"
          />
        </StatRow>
      </div>

      {view === "calendar" && calendarEvents ? (
        <div>
          <WeekCalendar weekStart={weekStart} events={calendarEvents} locale={locale} />
        </div>
      ) : (
        <div>
          <SectionHeading label={td.upcomingEvents} sub={td.nextByStart(cards.length)} />
          {cards.length === 0 ? (
            <EmptyState>{td.noUpcomingEvents}</EmptyState>
          ) : (
            <EventCardGrid>
              {cards.map((ev) => (
                <EventCard key={ev.id} ev={ev} t={t} />
              ))}
            </EventCardGrid>
          )}
        </div>
      )}

      <CashflowPanel cashflow={d.cashflow} t={t} />

      <div>
        <SectionHeading label={td.latestExpenses} sub={td.companyWideNewest} />
        <ExpenseList expenses={d.expenses} t={t} />
      </div>
    </DashboardShell>
  );
}
