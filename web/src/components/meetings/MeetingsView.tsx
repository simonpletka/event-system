"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { deleteMeetingAction } from "@/lib/actions/meetings";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatPragueDate, pragueDateKey } from "@/lib/prague-date";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";
import type { MeetingType, RecurrenceFreq } from "@/generated/prisma/enums";

type T = Dictionary["meetings"];

export type MeetingRow = {
  id: string;
  title: string;
  type: MeetingType;
  /** The occurrence shown: the next one, or the latest once it's over. */
  date: string;
  allDay: boolean;
  past: boolean;
  attendees: string;
  note: string;
  recurrenceFreq: RecurrenceFreq;
  recurrenceInterval: number;
  recurrenceUntil: string | null;
  projects: { id: string; title: string; href: string }[];
};

type Filter = "ALL" | MeetingType;

const TYPE_COLOR: Record<MeetingType, string> = { CLIENT: "#3987e5", INTERNAL: "#199e70" };

function TypeChip({ type, t }: { type: MeetingType; t: T }) {
  const color = TYPE_COLOR[type];
  return (
    <span
      className="tag whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color: `color-mix(in srgb, ${color} 72%, white)` }}
    >
      {type === "CLIENT" ? t.typeClient : t.typeInternal}
    </span>
  );
}

function repeats(m: MeetingRow, t: T, locale: Locale) {
  if (m.recurrenceFreq === "NONE") return t.form.recurrenceNone;
  const base =
    m.recurrenceInterval > 1
      ? t.repeatsEveryN(m.recurrenceFreq, m.recurrenceInterval)
      : m.recurrenceFreq === "DAILY"
        ? t.form.recurrenceDaily
        : m.recurrenceFreq === "WEEKLY"
          ? t.form.recurrenceWeekly
          : t.form.recurrenceMonthly;
  const until = m.recurrenceUntil ? ` ${t.repeatsUntil(formatPragueDate(m.recurrenceUntil, locale, { day: "numeric", month: "short", year: "numeric" }))}` : "";
  return base + until;
}

/** Upcoming meetings soonest first, then past ones latest first, grouped by Prague calendar day. */
function groupByDay(rows: MeetingRow[]) {
  const ordered = [...rows].sort((a, b) =>
    a.past !== b.past ? (a.past ? 1 : -1) : a.past ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
  );
  const groups = new Map<string, MeetingRow[]>();
  for (const row of ordered) {
    const key = pragueDateKey(row.date);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    items: [...items].sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

/**
 * Filters and selection are local state, so they don't touch the server or
 * lose the scroll position. Every date is formatted in Prague time so the
 * server-rendered HTML matches the browser's.
 */
export function MeetingsView({
  meetings,
  today,
  tomorrow,
  initialFilter,
  canManage,
  locale,
}: {
  meetings: MeetingRow[];
  today: string;
  tomorrow: string;
  initialFilter: Filter;
  canManage: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).meetings;
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  const visible = filter === "ALL" ? meetings : meetings.filter((m) => m.type === filter);
  const groups = groupByDay(visible);
  // Fall back to the first row: after a filter change or a delete the selected one may be gone.
  const selected = visible.find((m) => m.id === selectedId) ?? groups[0]?.items[0] ?? null;

  function choose(next: Filter) {
    setFilter(next);
    window.history.replaceState(window.history.state, "", next === "ALL" ? "/meetings" : `/meetings?type=${next}`);
  }

  function select(id: string) {
    setSelectedId(id);
    // Stacked layout: the details are below the list, so bring them into view.
    if (window.matchMedia?.("(max-width: 1023px)").matches) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      detailRef.current?.scrollIntoView?.({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  }

  const dayLabel = (key: string, iso: string) =>
    key === today ? t.today : key === tomorrow ? t.tomorrow : formatPragueDate(iso, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const chips: [Filter, string][] = [
    ["ALL", t.filterAll],
    ["CLIENT", t.typeClient],
    ["INTERNAL", t.typeInternal],
  ];

  return (
    <div>
      <div role="group" aria-label={t.filterByType} className="flex flex-wrap gap-1.5">
        {chips.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => choose(value)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.1em] uppercase border focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              filter === value ? "bg-accent border-accent text-white" : "border-ink/20 text-ink/55 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected === null ? (
        <section className="card p-8 mt-4 flex flex-col items-center gap-3 text-center">
          <p className="text-[13px] placeholder-text">{t.noMeetingsYet}</p>
          {canManage && (
            <Link href="/meetings/new" className="btn font-semibold">
              {t.newMeeting}
            </Link>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 mt-4 items-start">
          <section aria-label={t.upcomingAndPast} className="card p-4 md:p-5 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h2 className="heading-label !text-[12px] font-bold">{t.upcomingAndPast}</h2>
              <ul className="flex flex-wrap items-center gap-3 text-[11.5px] placeholder-text">
                <li className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLOR.CLIENT }} />
                  {t.typeClient}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLOR.INTERNAL }} />
                  {t.typeInternal}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-ink/30" />
                  {t.legendPast}
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group.key}>
                  <h3 className="heading-label !text-[10px] capitalize mb-1">{dayLabel(group.key, group.items[0].date)}</h3>
                  <ul>
                    {group.items.map((m) => (
                      <li key={m.id} className="border-t border-ink/8 first:border-t-0">
                        <button
                          type="button"
                          onClick={() => select(m.id)}
                          aria-pressed={selected.id === m.id}
                          className={`w-full text-left flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-ink/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent ${
                            selected.id === m.id ? "bg-ink/[0.08]" : ""
                          } ${m.past ? "opacity-50" : ""}`}
                        >
                          <span className="w-[52px] shrink-0 font-mono text-[11px] text-ink/60 whitespace-nowrap">
                            {m.allDay ? t.form.allDayLabel : formatPragueDate(m.date, locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-semibold truncate">{m.title}</span>
                            {m.projects.length > 0 && <span className="block text-[12px] placeholder-text truncate">{m.projects.map((p) => p.title).join(", ")}</span>}
                          </span>
                          <TypeChip type={m.type} t={t} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section ref={detailRef} aria-label={selected.title} className="card p-4 md:p-5 min-w-0 scroll-mt-28">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeChip type={selected.type} t={t} />
              {selected.past && <span className="tag tag-neutral whitespace-nowrap">{t.legendPast}</span>}
            </div>
            <h2 className="text-[18px] font-semibold leading-snug mt-2.5 break-words">{selected.title}</h2>

            <dl className="mt-4 flex flex-col gap-3 text-[13px]">
              <Field label={t.detailWhen}>
                {formatPragueDate(selected.date, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {selected.allDay ? ` · ${t.form.allDayLabel}` : ` · ${formatPragueDate(selected.date, locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`}
              </Field>
              <Field label={t.detailRepeats}>{repeats(selected, t, locale)}</Field>
              <Field label={t.detailAttendees}>{selected.attendees || "—"}</Field>
              <Field label={t.detailProjects}>
                {selected.projects.length === 0 ? (
                  "—"
                ) : (
                  <span className="flex flex-wrap gap-1.5 mt-0.5">
                    {selected.projects.map((p) => (
                      <Link key={p.id} href={p.href} className="text-[11px] px-2.5 py-1 rounded-full border border-ink/15 hover:text-accent hover:border-accent/50 break-words">
                        {p.title}
                      </Link>
                    ))}
                  </span>
                )}
              </Field>
              <Field label={t.detailNote}>
                <span className="whitespace-pre-wrap break-words">{selected.note || "—"}</span>
              </Field>
            </dl>

            {canManage && (
              <div className="flex gap-1.5 mt-5">
                <Link href={`/meetings/${selected.id}/edit`} className="btno">
                  {t.edit}
                </Link>
                <ConfirmDeleteButton action={deleteMeetingAction} fields={{ id: selected.id }} confirmMessage={t.confirmDelete(selected.title)} label={t.delete} />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="heading-label !text-[9.5px]">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}
