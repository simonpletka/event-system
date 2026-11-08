"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/format";
import { formatPragueRange } from "@/lib/prague-date";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { ProjectStatusChip } from "./ProjectStatusChip";
import { LIST_QUERY_KEY, STATUS_FILTERS, type StatusFilter } from "@/lib/project-list";

export type ProjectRow = {
  id: string;
  number: string;
  title: string;
  client: string;
  venue: string | null;
  start: string;
  end: string;
  status: ProjectStatus;
  value: number;
  href: string;
  /** Extra text the search also matches, e.g. contact names. */
  searchText: string;
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * The Projects list card. Every visible project is loaded once, so filters
 * and search work as you type; the URL is updated with replaceState (no
 * navigation, no re-render, scroll kept) so a reload or the detail page's
 * back link restores the same view.
 */
export function ProjectsList({
  projects,
  initialStatus,
  initialQuery,
  locale,
}: {
  projects: ProjectRow[];
  initialStatus: StatusFilter;
  initialQuery: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const tp = t.projects;
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState(initialQuery);

  function remember(nextStatus: StatusFilter, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const search = params.toString() ? `?${params}` : "";
    window.history.replaceState(window.history.state, "", `/projects${search}`);
    try {
      window.sessionStorage.setItem(LIST_QUERY_KEY, search);
    } catch {
      // Private mode can refuse storage; the back link then just opens the plain list.
    }
  }

  const allowed = STATUS_FILTERS[status];
  const q = normalize(query.trim());
  const shown = projects.filter(
    (p) =>
      (!allowed || allowed.includes(p.status)) &&
      (!q || normalize(`${p.number} ${p.title} ${p.client} ${p.venue ?? ""} ${p.searchText}`).includes(q))
  );

  const labels: [StatusFilter, string][] = [
    ["all", tp.filterAll],
    ["in-progress", tp.filterInProgress],
    ["confirmed", tp.filterConfirmed],
    ["to-invoice", tp.filterToInvoice],
    ["quote", tp.filterQuoteInquiry],
  ];

  return (
    <div>
      <section aria-label={tp.title} className="card p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div role="group" aria-label={tp.filterByStatus} className="flex flex-wrap gap-1.5">
            {labels.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value);
                  remember(value, query);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.1em] uppercase border focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  status === value ? "bg-accent border-accent text-white" : "border-ink/20 text-ink/55 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              remember(status, e.target.value);
            }}
            placeholder={tp.searchProjects}
            aria-label={tp.searchProjects}
            className="input text-[12px] py-2 w-full sm:w-[240px]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap mt-4 pb-2 border-b border-ink/10 text-[12px] placeholder-text">
          <span aria-live="polite">{tp.matchingCount(shown.length)}</span>
          <span>
            {tp.sortedByStart} ·{" "}
            <Link href="/projects?view=calendar" className="hover:text-accent underline underline-offset-2">
              {tp.weekCalendar}
            </Link>
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="text-[13px] placeholder-text py-4">{projects.length === 0 ? tp.noProjectsYet : tp.noProjectsMatch}</p>
        ) : (
          <ul className="flex flex-col">
            {shown.map((p) => (
              <li key={p.id} className="border-t border-ink/8 first:border-t-0">
                <Link
                  href={p.href}
                  className="group flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-1.5 py-3.5 px-2 -mx-2 rounded-xl hover:bg-ink/5"
                >
                  <span className="min-w-0 basis-full md:basis-auto md:flex-1">
                    <span className="block text-[11px] placeholder-text">{p.number}</span>
                    <span className="block text-[17px] font-semibold truncate group-hover:text-accent">{p.title}</span>
                    <span className="block text-[13px] placeholder-text truncate">{p.client}</span>
                  </span>
                  <span className="min-w-0 flex-1 md:flex-none md:w-[190px] text-[13px] placeholder-text">
                    <span className="block truncate">{p.venue ?? "—"}</span>
                    <span className="block">{formatPragueRange(p.start, p.end, locale)}</span>
                  </span>
                  <span className="shrink-0 md:w-[120px]">
                    <ProjectStatusChip status={p.status} t={t.statusProject} />
                  </span>
                  <span className="shrink-0 ml-auto md:ml-0 md:w-[110px] text-right text-[15px] font-semibold tabular-nums whitespace-nowrap group-hover:text-accent">
                    {p.value ? formatCurrency(p.value) : <span className="placeholder-text font-normal">—</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="label mt-3 px-1">{tp.listNote}</p>
    </div>
  );
}
