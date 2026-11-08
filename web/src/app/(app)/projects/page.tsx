import Link from "next/link";
import { requireUser, canCreateProject } from "@/lib/authz";
import { getProjectRows } from "@/lib/queries/projects";
import { projectHref } from "@/lib/slug";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { DateNav } from "@/components/calendar/DateNav";
import { isoDate, mondayOf, parseIsoDate } from "@/lib/calendar";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { parseStatusFilter } from "@/lib/project-list";
import { getLocale, getDictionary, type Dictionary } from "@/lib/i18n";

export default async function ProjectsPage({
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
    const { events, meetings } = await getWeekCalendarData(user, weekStart);

    return (
      <div>
        <PageHeader>
          <ViewHeader canCreate={canCreateProject(user)} t={t} />
          <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
            <ViewSwitch view="calendar" t={t} />
            <DateNav
              mode="single"
              weekStartIso={isoDate(weekStart)}
              basePath="/projects"
              extraQuery="view=calendar"
              todayLabel={t.calendar.today}
            />
          </div>
        </PageHeader>
        <div className="mt-4">
          <WeekCalendar weekStart={weekStart} events={events} meetings={meetings} locale={locale} />
        </div>
      </div>
    );
  }

  const rows = await getProjectRows(user);

  return (
    <div>
      <PageHeader>
        <div className="max-w-[1080px] flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-[46px] md:text-[60px] font-bold tracking-tight">{t.projects.title}</h1>
          {canCreateProject(user) && (
            <Link href="/projects/new" className="btn font-semibold">
              {t.projects.newProject}
            </Link>
          )}
        </div>
      </PageHeader>
      <div className="max-w-[1080px] mt-7">
        <ProjectsList
          projects={rows.map((p) => ({
            id: p.id,
            number: p.number,
            title: p.title,
            client: p.companyName,
            venue: p.venues[0]?.name ?? null,
            start: p.startDate.toISOString(),
            end: p.endDate.toISOString(),
            status: p.status,
            value: p.quotedValue,
            href: projectHref(p),
            searchText: p.contacts.map((c) => c.name).join(" "),
          }))}
          initialStatus={parseStatusFilter(params.status)}
          initialQuery={params.q ?? ""}
          locale={locale}
        />
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
        <div className="heading-label">{total !== undefined ? t.projects.headerCount(total, activeCount ?? 0) : " "}</div>
        <h1 className="text-[60px] font-bold tracking-tight mt-1">{t.projects.title}</h1>
      </div>
      {canCreate && (
        <Link href="/projects/new" className="btn font-semibold">
          {t.projects.newProject}
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
        { value: "table", label: t.projects.viewTable, href: "/projects" },
        { value: "calendar", label: t.projects.viewCalendar, href: "/projects?view=calendar" },
      ]}
    />
  );
}
