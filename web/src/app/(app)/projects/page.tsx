import Link from "next/link";
import { requireUser, canCreateProject } from "@/lib/authz";
import { getProjectList, type ProjectListFilters, type ProjectPeriod } from "@/lib/queries/projects";
import { projectHref, clientHref } from "@/lib/slug";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { formatCurrency, formatDateRange } from "@/lib/format";
import { ProjectStatusPill } from "@/components/StatusPill";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { DateNav } from "@/components/calendar/DateNav";
import { isoDate, mondayOf, parseIsoDate } from "@/lib/calendar";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FilterSearch } from "@/components/ui/FilterSearch";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { getLocale, getDictionary, type Dictionary } from "@/lib/i18n";
import type { ProjectStatus } from "@/generated/prisma/enums";

const STATUSES: ProjectStatus[] = [
  "INQUIRY",
  "QUOTE_SENT",
  "CONFIRMED",
  "IN_PROGRESS",
  "TO_INVOICE",
  "CLOSED",
  "CANCELLED",
];

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

  const filters: ProjectListFilters = {
    q: params.q || undefined,
    status: params.status || undefined,
    client: params.client || undefined,
    place: params.place || undefined,
    period: (params.period as ProjectPeriod) || undefined,
    month: params.month || undefined,
    year: params.year || undefined,
  };
  const { projects, total, activeCount, clients, places } = await getProjectList(user, filters);
  const now = new Date();
  // The list is sorted by start date descending, so "nearest upcoming" isn't
  // the first array match — it's whichever not-yet-ended project starts soonest.
  const firstUpcomingId = projects.reduce<(typeof projects)[number] | undefined>(
    (nearest, e) => (e.endDate >= now && (!nearest || e.startDate < nearest.startDate) ? e : nearest),
    undefined
  )?.id;
  const eventParams = {
    status: filters.status,
    client: filters.client,
    place: filters.place,
    q: filters.q,
    period: filters.period,
    month: filters.month,
    year: filters.year,
  };

  return (
    <div>
      <PageHeader>
        <ViewHeader canCreate={canCreateProject(user)} total={total} activeCount={activeCount} t={t} />

        <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <ViewSwitch view="table" t={t} />
            {firstUpcomingId && (
              <a href="#today-row" className="btno text-[9px]">
                {t.projects.today}
              </a>
            )}
          </div>

          <div className="flex gap-1.5 items-center flex-nowrap overflow-x-auto pb-1 md:pb-0 md:flex-wrap md:overflow-visible">
            <FilterSelect
              label={t.projects.statusFilter}
              value={filters.status ?? "ACTIVE"}
              options={[
                { value: "ACTIVE", label: t.projects.activeStatus },
                { value: "ANY", label: t.projects.anyStatus },
                ...STATUSES.map((s) => ({ value: s, label: t.statusProject[s] })),
              ]}
              basePath="/projects"
              params={eventParams}
              paramName="status"
            />
            <PeriodFilter
              period={filters.period}
              month={filters.month}
              year={filters.year}
              basePath="/projects"
              params={eventParams}
              t={{
                label: t.projects.periodFilter,
                anyTime: t.projects.anyTime,
                thisWeek: t.projects.periodThisWeek,
                future: t.projects.periodFuture,
                past: t.projects.periodPast,
                monthLabel: t.projects.periodMonth,
                yearLabel: t.projects.periodYear,
              }}
            />
            <FilterSelect
              label={t.projects.clientFilter}
              value={filters.client ?? ""}
              options={clients.map((c) => ({ value: c, label: c }))}
              basePath="/projects"
              params={eventParams}
              paramName="client"
              searchable
              searchPlaceholder={t.projects.searchClients}
              emptyLabel={t.projects.filterNoMatches}
              anyLabel={t.projects.anyClient}
            />
            <FilterSelect
              label={t.projects.placeFilter}
              value={filters.place ?? ""}
              options={places.map((p) => ({ value: p, label: p }))}
              basePath="/projects"
              params={eventParams}
              paramName="place"
              searchable
              searchPlaceholder={t.projects.searchPlaces}
              emptyLabel={t.projects.filterNoMatches}
              anyLabel={t.projects.anyPlace}
            />
            <FilterSearch value={filters.q ?? ""} basePath="/projects" params={eventParams} placeholder={t.common.search} />
            {(filters.q || filters.status || filters.client || filters.place || filters.period) && (
              <Link href="/projects" className="text-[9px] placeholder-text hover:text-ink underline underline-offset-2 shrink-0">
                {t.projects.clear}
              </Link>
            )}
          </div>
        </div>
      </PageHeader>

      <div className="hidden md:block">
        <div className="grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr_.6fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
          <span className="heading-label">{t.projects.colProject}</span>
          <span className="heading-label">{t.projects.clientFilter}</span>
          <span className="heading-label">{t.projects.colDates}</span>
          <span className="heading-label">{t.projects.placeFilter}</span>
          <span className="heading-label">{t.projects.colStatus}</span>
          <span className="heading-label">{t.projects.colValue}</span>
        </div>

        {projects.map((project) => (
          <div
            key={project.id}
            id={project.id === firstUpcomingId ? "today-row" : undefined}
            className="group relative grid grid-cols-[1.5fr_.9fr_.8fr_.8fr_.9fr_.6fr] gap-2.5 items-center py-3.5 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[15px] hover:bg-ink/5"
          >
            <Link href={projectHref(project)} aria-label={project.title} className="absolute inset-0 z-0" />
            <div className="group-hover:text-accent">
              <span className="placeholder-text text-[11px] mr-1 group-hover:!text-accent">{project.number}</span>
              <span className="text-[17px] font-semibold">{project.title}</span>
            </div>
            <div className="placeholder-text group-hover:!text-accent">
              {project.clientId ? (
                <Link href={clientHref({ id: project.clientId!, name: project.client?.name ?? "" })} className="relative z-[1] hover:text-accent">
                  {project.companyName}
                </Link>
              ) : (
                project.companyName
              )}
            </div>
            <div className="placeholder-text group-hover:!text-accent">{formatDateRange(project.startDate, project.endDate)}</div>
            <div className="placeholder-text group-hover:!text-accent">{project.venues[0]?.name ?? "—"}</div>
            <div>
              <ProjectStatusPill status={project.status} t={t.statusProject} />
            </div>
            <div className="font-semibold tabular-nums group-hover:text-accent">
              {project.quotedValue ? formatCurrency(project.quotedValue) : <span className="placeholder-text font-normal">—</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="md:hidden flex flex-col gap-2 mt-4">
        {projects.map((project) => (
          <MobileListRow
            key={project.id}
            href={projectHref(project)}
            subLeft={project.number}
            title={project.title}
            tag={<ProjectStatusPill status={project.status} t={t.statusProject} />}
            meta={`${project.companyName} · ${formatDateRange(project.startDate, project.endDate)} · ${project.venues[0]?.name ?? "—"}`}
            trailing={project.quotedValue ? formatCurrency(project.quotedValue) : "—"}
          />
        ))}
      </div>

      {projects.length === 0 && (
        <EmptyState
          message={t.projects.noProjectsMatch}
          actionLabel={canCreateProject(user) && !(filters.q || filters.status || filters.client || filters.place || filters.period) ? t.projects.newProject : undefined}
          actionHref="/projects/new"
        />
      )}

      <div className="mt-4 px-3.5">
        <div className="label">{t.projects.sortedBy(projects.length, total)}</div>
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
        <h1 className="text-[43px] font-bold tracking-tight mt-1">{t.projects.title}</h1>
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
