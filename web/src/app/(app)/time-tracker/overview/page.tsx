import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getOverviewData, getOverviewUsers, type TimePeriod } from "@/lib/queries/timetracker";
import { formatMinutes, niceAxisMax } from "@/lib/format";
import { getLocale, getDictionary, type Dictionary } from "@/lib/i18n";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { ChartAxisGrid } from "@/components/ui/ChartAxisGrid";
import { DateJumpPicker } from "@/components/timetracker/DateJumpPicker";
import { isoDate, parseIsoDate } from "@/lib/calendar";
import { stepDate, periodLabel } from "@/lib/period-nav";
import { categoricalColor } from "@/lib/chart-colors";

type OverviewPerson = Awaited<ReturnType<typeof getOverviewData>>["people"][number];
type OverviewBucket = Awaited<ReturnType<typeof getOverviewData>>["buckets"][number];

function overviewHref(params: { period?: string; date?: string; users?: string }) {
  const qs = new URLSearchParams();
  if (params.period) qs.set("period", params.period);
  if (params.date) qs.set("date", params.date);
  if (params.users) qs.set("users", params.users);
  const s = qs.toString();
  return `/time-tracker/overview${s ? `?${s}` : ""}`;
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
  const period: TimePeriod = params.period === "day" || params.period === "month" ? params.period : "week";
  const anchor = params.date ? parseIsoDate(params.date) : new Date();
  const selectedIds = params.users ? params.users.split(",").filter(Boolean) : [user.id];

  const allUsers = await getOverviewUsers();
  const selectedUsers = allUsers.filter((u) => selectedIds.includes(u.id));
  const addable = allUsers.filter((u) => !selectedIds.includes(u.id));

  const { buckets, people } = await getOverviewData(selectedUsers, period, anchor);

  const periodOptions = [
    { value: "day", label: tt.day, href: overviewHref({ period: "day", users: params.users }) },
    { value: "week", label: tt.week, href: overviewHref({ period: "week", users: params.users }) },
    { value: "month", label: tt.month, href: overviewHref({ period: "month", users: params.users }) },
  ];

  const prevHref = overviewHref({ period, date: isoDate(stepDate(period, anchor, -1)), users: params.users });
  const nextHref = overviewHref({ period, date: isoDate(stepDate(period, anchor, 1)), users: params.users });
  const todayHref = overviewHref({ period, users: params.users });

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
          <DateJumpPicker value={isoDate(anchor)} base={overviewHref({ period, users: params.users })} />
        </div>
      </div>

      <div className="flex gap-1.5 items-center pb-2.5 mt-4 border-b border-ink/20 flex-nowrap overflow-x-auto md:flex-wrap md:overflow-visible">
        <span className="label mr-1 shrink-0">{to.people}</span>
        {selectedUsers.map((u) => (
          <Link
            key={u.id}
            href={overviewHref({ period, date: params.date, users: selectedIds.filter((id) => id !== u.id).join(",") })}
            className="btno text-[9px] shrink-0"
          >
            {u.name} ×
          </Link>
        ))}
        <AddPersonPicker
          options={addable}
          hrefFor={(id) => overviewHref({ period, date: params.date, users: [...selectedIds, id].join(",") })}
        />
      </div>

      {people.length === 0 ? (
        <p className="text-sm placeholder-text mt-4">{to.selectAtLeastOne}</p>
      ) : period === "day" ? (
        <DayBreakdown people={people} t={t} />
      ) : (
        <BucketTable buckets={buckets} people={people} t={t} />
      )}
    </div>
  );
}

function AddPersonPicker({ options, hrefFor }: { options: { id: string; name: string }[]; hrefFor: (id: string) => string }) {
  if (options.length === 0) return null;
  return (
    <div className="flex gap-1 flex-nowrap md:flex-wrap shrink-0">
      {options.map((u) => (
        <Link key={u.id} href={hrefFor(u.id)} className="btno text-[9px] shrink-0">
          + {u.name}
        </Link>
      ))}
    </div>
  );
}

function DayBreakdown({ people, t }: { people: OverviewPerson[]; t: Dictionary }) {
  const to = t.timeTracker.overview;
  return (
    <div className="overflow-x-auto mt-3">
      <div
        className="grid gap-px border border-ink/20"
        style={{ gridTemplateColumns: `repeat(${people.length}, minmax(140px,1fr))`, minWidth: people.length * 140 }}
      >
        {people.map((p) => (
          <div key={p.id} className="bg-surface px-3 py-3">
            <div className="heading-label">{p.name}</div>
            <div className="text-xl font-semibold tracking-tight mt-0.5">{formatMinutes(p.total)}</div>
            {p.eventBreakdown.length === 0 ? (
              <div className="placeholder-text text-[11px] mt-2">{to.noTimeLogged}</div>
            ) : (
              <div className="mt-2 flex flex-col gap-1">
                {p.eventBreakdown.map((e) => (
                  <div key={e.title} className="flex justify-between gap-2 text-[11px]">
                    <span className="placeholder-text truncate">{e.title}</span>
                    <span>{formatMinutes(e.minutes)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BucketTable({ buckets, people, t }: { buckets: OverviewBucket[]; people: OverviewPerson[]; t: Dictionary }) {
  const to = t.timeTracker.overview;
  const cols = `minmax(110px,1fr) repeat(${buckets.length}, minmax(56px,.7fr)) minmax(56px,.7fr)`;
  const axisMax = niceAxisMax(Math.max(1, ...people.flatMap((p) => p.byBucket)));
  const axisTicks = [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0].map((m) => formatMinutes(m));

  return (
    <>
      <div className="card px-5 py-4 mt-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="heading-label !text-[12px]">{to.chartTitle}</div>
          <div className="flex gap-4 flex-wrap justify-end">
            {people.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1.5 text-[12px] text-ink/72">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: categoricalColor(i) }} />
                {p.name}
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="relative h-56 mt-5" style={{ minWidth: 74 + buckets.length * 60 }}>
            <ChartAxisGrid ticks={axisTicks} />
            <div className="absolute left-[74px] right-1 top-0 bottom-0 flex items-end justify-between gap-2">
              {buckets.map((b, bi) => (
                <div key={bi} className="flex items-end justify-center gap-1" style={{ height: 224 }}>
                  {people.map((p, pi) => (
                    <div
                      key={p.id}
                      className="w-3 rounded-t"
                      style={{ height: `${(p.byBucket[bi] / axisMax) * 100}%`, background: categoricalColor(pi) }}
                      title={`${p.name} · ${b.label} · ${formatMinutes(p.byBucket[bi])}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex ml-[74px] mr-1 justify-between mt-2.5" style={{ minWidth: buckets.length * 60 }}>
            {buckets.map((b, i) => (
              <span key={i} className="text-[11.5px] placeholder-text flex-1 text-center">
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div style={{ minWidth: 110 + buckets.length * 56 + 56 }}>
          <div className="grid gap-2 border-b-2 border-ink pb-1.5" style={{ gridTemplateColumns: cols }}>
            <span className="heading-label">{to.colPerson}</span>
            {buckets.map((b, i) => (
              <span key={i} className="heading-label text-center">
                {b.label}
              </span>
            ))}
            <span className="heading-label text-right">{to.colTotal}</span>
          </div>
          {people.map((p, pi) => (
            <div key={p.id} className="grid gap-2 py-2 text-[13px] items-center border-b border-ink/8 last:border-b-0" style={{ gridTemplateColumns: cols }}>
              <div className="truncate flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: categoricalColor(pi) }} />
                {p.name}
              </div>
              {p.byBucket.map((m, i) => (
                <div key={i} className="text-center placeholder-text">
                  {m ? formatMinutes(m) : "—"}
                </div>
              ))}
              <div className="text-right font-semibold">{formatMinutes(p.total)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
