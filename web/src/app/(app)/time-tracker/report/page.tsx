import Link from "next/link";
import { requireUser } from "@/lib/authz";
import {
  getOverviewData,
  getOverviewUsers,
  getOverviewProjects,
  getOverviewClients,
  type TimePeriod,
  type OverviewAxis,
  type OverviewRow,
  type OverviewBucket,
} from "@/lib/queries/timetracker";
import { formatMinutes, formatDurationShort, niceMinutesAxis } from "@/lib/format";
import { getLocale, getDictionary, type Dictionary } from "@/lib/i18n";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Menu, MenuLink } from "@/components/ui/Menu";
import { ColumnsIcon } from "@/components/ui/icons";
import { DateJumpPicker } from "@/components/timetracker/DateJumpPicker";
import { FilterChip } from "@/components/timetracker/FilterChip";
import { TextFilterChip } from "@/components/timetracker/TextFilterChip";
import { OverviewChart } from "@/components/timetracker/OverviewChart";
import { isoDate, parseIsoDate } from "@/lib/calendar";
import { stepDate, periodLabel } from "@/lib/period-nav";
import { categoricalColor } from "@/lib/chart-colors";
import { overviewHref } from "@/lib/timetracker-report-url";
import { projectHref } from "@/lib/slug";
import type { TimePhase } from "@/generated/prisma/enums";

/** The one place a row's raw id/name becomes a displayed label — phase rows carry no name of their own, just a TimePhase key. */
function rowLabel(row: OverviewRow, axis: OverviewAxis, t: Dictionary) {
  if (axis === "phase") return t.phases[row.id as TimePhase];
  return row.name ?? t.timeTracker.unassignedProject;
}

/** Same label, but a project row (which carries a real project id + name) links through to that project. */
function rowLabelNode(row: OverviewRow, axis: OverviewAxis, t: Dictionary, projectsById: Map<string, { number: string; title: string }>) {
  if (axis === "project" && row.name) {
    const project = projectsById.get(row.id);
    if (!project) return row.name;
    return (
      <Link href={projectHref(project)} className="hover:text-accent">
        {row.name}
      </Link>
    );
  }
  return rowLabel(row, axis, t);
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const t = getDictionary(await getLocale());
  const tt = t.timeTracker.tracking;
  const to = t.timeTracker.overview;
  const period: TimePeriod =
    params.period === "day" || params.period === "month" || params.period === "year" ? params.period : "week";
  const anchor = params.date ? parseIsoDate(params.date) : new Date();
  const axis: OverviewAxis = params.by === "project" ? "project" : params.by === "phase" ? "phase" : "person";
  const selectedIds = params.users ? params.users.split(",").filter(Boolean) : [user.id];
  const selectedProjectIds = params.projects ? params.projects.split(",").filter(Boolean) : [];
  const selectedClientIds = params.clients ? params.clients.split(",").filter(Boolean) : [];

  const [allUsers, allProjects, allClients] = await Promise.all([getOverviewUsers(), getOverviewProjects(user), getOverviewClients(user)]);

  const projectOptions = [
    { id: "unassigned", name: t.timeTracker.unassignedProject },
    ...allProjects.map((e) => ({ id: e.id, name: e.title })),
  ];
  const projectsById = new Map(allProjects.map((e) => [e.id, { number: e.number, title: e.title }]));

  const { buckets, rows } = await getOverviewData(
    allUsers.filter((u) => selectedIds.includes(u.id)),
    period,
    anchor,
    axis,
    selectedProjectIds.length > 0 ? selectedProjectIds : null,
    selectedClientIds.length > 0 ? selectedClientIds : null,
    params.q ?? null
  );

  const baseParams = { users: params.users, projects: params.projects, clients: params.clients, q: params.q, by: params.by };
  const filterBase = { period, date: params.date, ...baseParams };

  const periodOptions = [
    { value: "day", label: tt.day, href: overviewHref({ period: "day", ...baseParams }) },
    { value: "week", label: tt.week, href: overviewHref({ period: "week", ...baseParams }) },
    { value: "month", label: tt.month, href: overviewHref({ period: "month", ...baseParams }) },
    { value: "year", label: tt.year, href: overviewHref({ period: "year", ...baseParams }) },
  ];

  const prevHref = overviewHref({ period, date: isoDate(stepDate(period, anchor, -1)), ...baseParams });
  const nextHref = overviewHref({ period, date: isoDate(stepDate(period, anchor, 1)), ...baseParams });
  const todayHref = overviewHref({ period, ...baseParams });

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SegmentedTabs options={periodOptions} active={period} />
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={prevHref} className="btno px-2 py-1.5">
            ←
          </Link>
          <span className="text-[10px] tracking-[0.1em] uppercase min-w-[150px] text-center">{periodLabel(period, anchor)}</span>
          <Link href={nextHref} className="btno px-2 py-1.5">
            →
          </Link>
          <Link href={todayHref} className="btno">
            {to.today}
          </Link>
          <DateJumpPicker value={isoDate(anchor)} base={overviewHref({ period, ...baseParams })} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
        <div className="flex gap-1.5 items-center flex-wrap">
          <FilterChip
            label={to.people}
            options={allUsers}
            selectedIds={selectedIds}
            params={filterBase}
            paramName="users"
            searchPlaceholder={t.common.search}
            emptyLabel={to.noMatches}
            allLabel={to.all}
            noneLabel={to.none}
            addLabel={to.add}
          />
          <FilterChip
            label={to.projects}
            options={projectOptions}
            selectedIds={selectedProjectIds}
            params={filterBase}
            paramName="projects"
            searchPlaceholder={t.common.search}
            emptyLabel={to.noMatches}
            allLabel={to.all}
            noneLabel={to.none}
            addLabel={to.add}
          />
          <FilterChip
            label={to.clients}
            options={allClients}
            selectedIds={selectedClientIds}
            params={filterBase}
            paramName="clients"
            searchPlaceholder={t.common.search}
            emptyLabel={to.noMatches}
            allLabel={to.all}
            noneLabel={to.none}
            addLabel={to.add}
          />
          <TextFilterChip
            label={to.description}
            value={params.q ?? ""}
            params={filterBase}
            placeholder={to.descriptionPlaceholder}
            addLabel={to.add}
          />
        </div>
        <BreakdownBySelect axis={axis} hrefFor={(a) => overviewHref({ ...filterBase, by: a })} t={to} />
      </div>

      {selectedIds.length === 0 ? (
        <p className="text-sm placeholder-text mt-3">{to.selectAtLeastOne}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm placeholder-text mt-3">{to.noTimeLogged}</p>
      ) : period === "day" ? (
        <DayBreakdown rows={rows} axis={axis} t={t} projectsById={projectsById} />
      ) : (
        <BucketTable buckets={buckets} rows={rows} axis={axis} t={t} projectsById={projectsById} />
      )}
    </div>
  );
}

function BreakdownBySelect({ axis, hrefFor, t }: { axis: OverviewAxis; hrefFor: (axis: OverviewAxis) => string; t: Dictionary["timeTracker"]["overview"] }) {
  const options: { value: OverviewAxis; label: string }[] = [
    { value: "person", label: t.byPerson },
    { value: "project", label: t.byProject },
    { value: "phase", label: t.byPhase },
  ];
  const current = options.find((o) => o.value === axis)!;
  return (
    <Menu icon={<ColumnsIcon size={13} />} value={current.label} align="right" width={140}>
      {options.map((o) => (
        <MenuLink key={o.value} href={hrefFor(o.value)} active={o.value === axis}>
          {o.label}
        </MenuLink>
      ))}
    </Menu>
  );
}

function DayBreakdown({ rows, axis, t, projectsById }: { rows: OverviewRow[]; axis: OverviewAxis; t: Dictionary; projectsById: Map<string, { number: string; title: string }> }) {
  return (
    <div className="overflow-x-auto mt-3">
      <div
        className="grid gap-px border border-ink/20"
        style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(140px,1fr))`, minWidth: rows.length * 140 }}
      >
        {rows.map((r) => (
          <div key={r.id} className="bg-surface px-3 py-3">
            <div className="heading-label truncate">{rowLabelNode(r, axis, t, projectsById)}</div>
            <div className="text-xl font-semibold tracking-tight mt-0.5">{formatMinutes(r.total)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BucketTable({ buckets, rows, axis, t, projectsById }: { buckets: OverviewBucket[]; rows: OverviewRow[]; axis: OverviewAxis; t: Dictionary; projectsById: Map<string, { number: string; title: string }> }) {
  const to = t.timeTracker.overview;
  const colHeadingByAxis = { person: to.byPerson, project: to.byProject, phase: to.byPhase };
  const cols = `minmax(110px,1fr) repeat(${buckets.length}, minmax(56px,.7fr)) minmax(56px,.7fr)`;
  const { axisMax, ticks } = niceMinutesAxis(Math.max(1, ...rows.flatMap((r) => r.byBucket)));
  const axisTicks = ticks.map(formatDurationShort);
  // A single series is the viewer's own time — render it monochrome on the
  // app ink so it reads as part of the UI, not a categorical dataset. The
  // categorical palette only earns its keep when series are being compared.
  const singleSeries = rows.length === 1;
  const chartRows = rows.map((r, i) => ({
    id: r.id,
    label: rowLabel(r, axis, t),
    color: singleSeries ? "color-mix(in srgb, var(--color-ink) 42%, transparent)" : categoricalColor(i),
    byBucket: r.byBucket,
  }));
  const chartBuckets = buckets.map((b) => ({ label: b.label }));

  return (
    <>
      <div className="card px-5 py-4 mt-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="heading-label !text-[12px]">{to.chartTitle}</div>
          {chartRows.length > 1 && (
            <div className="flex gap-4 flex-wrap justify-end">
              {chartRows.map((r) => (
                <span key={r.id} className="flex items-center gap-1.5 text-[12px] text-ink/72">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                  {r.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <OverviewChart buckets={chartBuckets} rows={chartRows} axisMax={axisMax} axisTicks={axisTicks} totalLabel={to.colTotal} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div style={{ minWidth: 110 + buckets.length * 56 + 56 }}>
          <div className="grid gap-2 border-b-2 border-ink pb-1.5" style={{ gridTemplateColumns: cols }}>
            <span className="heading-label">{colHeadingByAxis[axis]}</span>
            {buckets.map((b, i) => (
              <span key={i} className="heading-label text-center">
                {b.label}
              </span>
            ))}
            <span className="heading-label text-right">{to.colTotal}</span>
          </div>
          {rows.map((r, ri) => (
            <div key={r.id} className="grid gap-2 py-2 text-[13px] items-center border-b border-ink/8 last:border-b-0" style={{ gridTemplateColumns: cols }}>
              <div className="truncate flex items-center gap-2">
                {rows.length > 1 && (
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: categoricalColor(ri) }} />
                )}
                {rowLabelNode(r, axis, t, projectsById)}
              </div>
              {r.byBucket.map((m, i) => (
                <div key={i} className="text-center placeholder-text">
                  {m ? formatMinutes(m) : "—"}
                </div>
              ))}
              <div className="text-right font-semibold">{formatMinutes(r.total)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
