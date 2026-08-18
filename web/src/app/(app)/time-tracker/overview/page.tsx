import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getOverviewData, getOverviewUsers, type TimePeriod } from "@/lib/queries/timetracker";
import { formatMinutes } from "@/lib/format";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { DateJumpPicker } from "@/components/timetracker/DateJumpPicker";
import { isoDate, parseIsoDate } from "@/lib/calendar";
import { stepDate, periodLabel } from "@/lib/period-nav";

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
  const period: TimePeriod = params.period === "day" || params.period === "month" ? params.period : "week";
  const anchor = params.date ? parseIsoDate(params.date) : new Date();
  const selectedIds = params.users ? params.users.split(",").filter(Boolean) : [user.id];

  const allUsers = await getOverviewUsers();
  const selectedUsers = allUsers.filter((u) => selectedIds.includes(u.id));
  const addable = allUsers.filter((u) => !selectedIds.includes(u.id));

  const { buckets, people } = await getOverviewData(selectedUsers, period, anchor);

  const periodOptions = [
    { value: "day", label: "Day", href: overviewHref({ period: "day", users: params.users }) },
    { value: "week", label: "Week", href: overviewHref({ period: "week", users: params.users }) },
    { value: "month", label: "Month", href: overviewHref({ period: "month", users: params.users }) },
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
            Today
          </Link>
          <DateJumpPicker value={isoDate(anchor)} base={overviewHref({ period, users: params.users })} />
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap items-center pb-2.5 mt-4 border-b border-ink/20">
        <span className="label mr-1">People</span>
        {selectedUsers.map((u) => (
          <Link
            key={u.id}
            href={overviewHref({ period, date: params.date, users: selectedIds.filter((id) => id !== u.id).join(",") })}
            className="btno text-[9px]"
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
        <p className="text-sm placeholder-text mt-4">Select at least one person to see their tracked time.</p>
      ) : period === "day" ? (
        <DayBreakdown people={people} />
      ) : (
        <BucketTable buckets={buckets} people={people} />
      )}
    </div>
  );
}

function AddPersonPicker({ options, hrefFor }: { options: { id: string; name: string }[]; hrefFor: (id: string) => string }) {
  if (options.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((u) => (
        <Link key={u.id} href={hrefFor(u.id)} className="btno text-[9px]">
          + {u.name}
        </Link>
      ))}
    </div>
  );
}

function DayBreakdown({ people }: { people: OverviewPerson[] }) {
  return (
    <div className="grid gap-px mt-3 border border-ink/20" style={{ gridTemplateColumns: `repeat(${people.length}, minmax(0,1fr))` }}>
      {people.map((p) => (
        <div key={p.id} className="bg-surface px-3 py-3">
          <div className="heading-label">{p.name}</div>
          <div className="text-xl font-semibold tracking-tight mt-0.5">{formatMinutes(p.total)}</div>
          {p.eventBreakdown.length === 0 ? (
            <div className="placeholder-text text-[11px] mt-2">No time logged.</div>
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
  );
}

function BucketTable({ buckets, people }: { buckets: OverviewBucket[]; people: OverviewPerson[] }) {
  const cols = `1fr repeat(${buckets.length}, .7fr) .7fr`;
  return (
    <div className="mt-4">
      <div className="grid gap-2 border-b-2 border-ink pb-1.5" style={{ gridTemplateColumns: cols }}>
        <span className="heading-label">Person</span>
        {buckets.map((b, i) => (
          <span key={i} className="heading-label text-center">
            {b.label}
          </span>
        ))}
        <span className="heading-label text-right">Total</span>
      </div>
      {people.map((p) => (
        <div key={p.id} className="grid gap-2 py-2 text-[13px] items-center border-b border-ink/8 last:border-b-0" style={{ gridTemplateColumns: cols }}>
          <div>{p.name}</div>
          {p.byBucket.map((m, i) => (
            <div key={i} className="text-center placeholder-text">
              {m ? formatMinutes(m) : "—"}
            </div>
          ))}
          <div className="text-right font-semibold">{formatMinutes(p.total)}</div>
        </div>
      ))}
    </div>
  );
}
