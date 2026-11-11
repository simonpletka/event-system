import { requireUser } from "@/lib/authz";
import { getProjectRows } from "@/lib/queries/projects";
import { projectHref } from "@/lib/slug";
import { getWeekCalendarData } from "@/lib/queries/calendar";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { DateNav } from "@/components/calendar/DateNav";
import { mondayKey, pragueDateKey } from "@/lib/prague-date";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { parseStatusFilter } from "@/lib/project-list";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  if (params.view === "calendar") {
    const today = pragueDateKey(new Date());
    const weekKey = mondayKey(/^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "") ? params.week! : today);
    const { events, meetings } = await getWeekCalendarData(user, weekKey);

    return (
      <div className="max-w-[1080px] mt-5">
        <DateNav
          mode="single"
          weekStartIso={weekKey}
          todayWeekIso={mondayKey(today)}
          basePath="/projects"
          extraQuery="view=calendar"
          todayLabel={t.calendar.today}
        />
        <div className="mt-4">
          <WeekCalendar key={weekKey} weekKey={weekKey} today={today} events={events} meetings={meetings} locale={locale} />
        </div>
      </div>
    );
  }

  const rows = await getProjectRows(user);

  return (
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
  );
}
