import Link from "next/link";
import { requireUser, eventWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCompareEventsData } from "@/lib/queries/timetracker";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { PHASE_LABEL, PHASES } from "@/lib/time-phases";

const PHASE_COLOR: Record<string, string> = {
  PLANNING: "bg-ink/50",
  SUPPLIERS: "bg-ink/25",
  ON_SITE: "bg-accent",
  WRAP_UP: "bg-ink/12",
};

export default async function CompareEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedIds = (params.events ?? "").split(",").filter(Boolean);

  const [data, allEvents] = await Promise.all([
    getCompareEventsData(user, selectedIds),
    prisma.event.findMany({ where: eventWhereForUser(user), select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  const selectedTitles = new Map(allEvents.map((e) => [e.id, e.title]));
  const addable = allEvents.filter((e) => !selectedIds.includes(e.id));
  const maxHours = Math.max(1, ...(data?.events.map((e) => e.totalMinutes) ?? [1]));

  return (
    <div>
      <div className="flex justify-between items-end mb-3">
        <div className="label">{selectedIds.length} events selected</div>
        {selectedIds.length > 0 && (
          <a href={`/api/time-tracker/compare/export?events=${selectedIds.join(",")}`} className="btno">
            Export CSV
          </a>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap items-center pb-2.5 border-b border-ink/20">
        <span className="label mr-1">Events</span>
        {selectedIds.map((id) => (
          <Link
            key={id}
            href={`/time-tracker/compare?events=${selectedIds.filter((x) => x !== id).join(",")}`}
            className="btno text-[9px]"
          >
            {selectedTitles.get(id) ?? id} ×
          </Link>
        ))}
        <AddEventPicker selectedIds={selectedIds} addable={addable} />
      </div>

      {!data || data.events.length === 0 ? (
        <p className="text-sm placeholder-text mt-4">Select at least one event to compare.</p>
      ) : (
        <>
          <div className="grid gap-px mt-3 border border-ink/20" style={{ gridTemplateColumns: `repeat(${data.events.length}, minmax(0,1fr))` }}>
            {data.events.map((e) => (
              <div key={e.id} className="bg-surface px-2.5 py-2.5">
                <div className="heading-label">{e.title}</div>
                <div className="text-xl font-semibold tracking-tight mt-0.5">{formatMinutes(e.totalMinutes)}</div>
                <div className="placeholder-text text-[9px] mt-0.5">
                  {e.peopleCount} people · {formatCurrency(e.quotedValue)} quoted
                  {e.costPerHour ? ` · ${formatCurrency(e.costPerHour)} / h` : ""}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1.2fr_1fr] gap-4 mt-4">
            <div>
              <div className="label mb-2">Hours by phase</div>
              {data.events.map((e) => (
                <div key={e.id} className="grid grid-cols-[110px_1fr] items-center gap-2 mb-2">
                  <div className="text-[11px] truncate">{e.title}</div>
                  <div className="flex h-[18px]" style={{ width: `${(e.totalMinutes / maxHours) * 100}%` }}>
                    {PHASES.map((p) => (
                      <div
                        key={p}
                        className={PHASE_COLOR[p]}
                        style={{ width: e.totalMinutes ? `${(e.phaseMinutes[p] / e.totalMinutes) * 100}%` : 0 }}
                        title={`${PHASE_LABEL[p]}: ${formatMinutes(e.phaseMinutes[p])}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-3 flex-wrap mt-2">
                {PHASES.map((p) => (
                  <div key={p} className="flex gap-1.5 items-center">
                    <div className={`w-2.5 h-2.5 ${PHASE_COLOR[p]}`} />
                    <div className="label">{PHASE_LABEL[p]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="label mb-1">Per person</div>
              <div className="grid gap-2 border-b-2 border-ink pb-1.5" style={{ gridTemplateColumns: `1fr repeat(${data.events.length}, .6fr)` }}>
                <span className="heading-label">Person</span>
                {data.events.map((e) => (
                  <span key={e.id} className="heading-label truncate">
                    {e.title}
                  </span>
                ))}
              </div>
              {data.personRows.map((p) => (
                <div key={p.userId} className="grid gap-2 py-1.5 text-[13px]" style={{ gridTemplateColumns: `1fr repeat(${data.events.length}, .6fr)` }}>
                  <div>{p.name}</div>
                  {data.events.map((e) => (
                    <div key={e.id} className="placeholder-text">
                      {p.minutesByEvent[e.id] ? formatMinutes(p.minutesByEvent[e.id]) : "—"}
                    </div>
                  ))}
                </div>
              ))}
              <div className="label mt-2">Visibility follows the role — a producer sees their own events, admin sees all.</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AddEventPicker({ selectedIds, addable }: { selectedIds: string[]; addable: { id: string; title: string }[] }) {
  if (addable.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {addable.map((e) => (
        <Link key={e.id} href={`/time-tracker/compare?events=${[...selectedIds, e.id].join(",")}`} className="btno text-[9px]">
          + {e.title}
        </Link>
      ))}
    </div>
  );
}
