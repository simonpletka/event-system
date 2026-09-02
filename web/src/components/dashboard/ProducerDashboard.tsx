import Link from "next/link";
import { getProducerDashboard } from "@/lib/queries/dashboard";
import { getOverviewData } from "@/lib/queries/timetracker";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { getDictionary, type Locale } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { projectHref } from "@/lib/slug";
import { mondayOf, parseIsoDate } from "@/lib/calendar";
import type { SessionUser } from "@/lib/authz";
import { DashboardShell, NewEventAction } from "./DashboardShell";
import {
  SectionHeading,
  ProjectCard,
  ProjectCardGrid,
  RowCard,
  Row,
  TrackedTimeChart,
  EmptyState,
  type DashProjectCard,
} from "./widgets";

const SOON_MS = 3 * 86_400_000;

export async function ProducerDashboard({
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

  const [d, timeData, calendarEvents] = await Promise.all([
    getProducerDashboard(user),
    getOverviewData([{ id: user.id, name: user.name ?? "" }], "week", new Date()),
    view === "calendar" ? getWeekCalendarData(user, weekStart) : Promise.resolve(null),
  ]);
  const myTime = timeData.rows[0];
  const now = new Date().getTime();

  const cards: DashProjectCard[] = d.myProjects.map((e) => ({
    id: e.id,
    number: e.number,
    title: e.title,
    company: e.companyName,
    status: e.status,
    start: e.startDate,
    end: e.endDate,
    venue: e.venue,
    nextTitle: e.nextItem?.title ?? null,
    budget: { amount: e.budgetAmount, spent: e.spent },
  }));

  return (
    <DashboardShell
      title={td.title}
      action={<NewEventAction label={td.newProject} />}
      view={view}
      weekStart={weekStart}
      weekHrefBase="/dashboard"
      todayLabel={t.calendar.today}
      listLabel={td.viewList}
      calendarLabel={td.viewCalendar}
    >
      {view === "calendar" && calendarEvents ? (
        <div>
          <WeekCalendar weekStart={weekStart} events={calendarEvents.events} meetings={calendarEvents.meetings} locale={locale} />
        </div>
      ) : (
        <div>
          <SectionHeading label={td.myProjects} sub={td.myEventsAssignedActive} />
          {cards.length === 0 ? (
            <EmptyState>{td.noAssignedProjects}</EmptyState>
          ) : (
            <ProjectCardGrid>
              {cards.map((ev) => (
                <ProjectCard key={ev.id} ev={ev} t={t} />
              ))}
            </ProjectCardGrid>
          )}
        </div>
      )}

      <div>
        <SectionHeading label={td.assignedToMe} sub={td.roadmapNextDays(14)} />
        {d.roadmap.length === 0 ? (
          <EmptyState>{td.nothingAssignedSoon}</EmptyState>
        ) : (
          <RowCard>
            {d.roadmap.map((item) => (
              <Link key={item.id} href={projectHref(item.project, "/roadmap")} className="block">
                <Row>
                  <span className="font-mono text-[11px] text-ink/45 whitespace-nowrap w-[86px] shrink-0">
                    {formatDate(item.date, { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="flex-1 min-w-0 truncate">
                    {item.title} <span className="placeholder-text">· {item.project.title}</span>
                  </span>
                  {item.date.getTime() - now <= SOON_MS && (
                    <span className="tag tag-attention whitespace-nowrap">{td.dueSoon}</span>
                  )}
                </Row>
              </Link>
            ))}
          </RowCard>
        )}
      </div>

      <TrackedTimeChart
        buckets={timeData.buckets}
        byBucket={myTime?.byBucket ?? []}
        total={myTime?.total ?? 0}
        t={t}
      />
    </DashboardShell>
  );
}
