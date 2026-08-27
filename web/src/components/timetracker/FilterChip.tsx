"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { overviewHref, type OverviewUrlParams } from "@/lib/timetracker-report-url";

type Option = { id: string; name: string };

/**
 * A Toggl-style filter chip: a persistent button (not per-option "+ Name"
 * links) that opens a searchable checkbox multi-select. Checking a box
 * navigates immediately (matches Toggl: the chip's own summary text updates
 * live while the panel is still open) — the panel's own "Add" button just
 * closes it, it isn't a separate commit step.
 *
 * `hrefFor` can't cross the Server→Client boundary as a closure, so this
 * takes the other current params as plain data plus which field this chip
 * controls, and builds the href itself via the shared pure `overviewHref`.
 */
export function FilterChip({
  label,
  options,
  selectedIds,
  params,
  paramName,
  searchPlaceholder,
  emptyLabel,
  allLabel,
  noneLabel,
  addLabel,
}: {
  label: string;
  options: Option[];
  selectedIds: string[];
  params: OverviewUrlParams;
  paramName: "users" | "events" | "clients";
  searchPlaceholder: string;
  emptyLabel: string;
  allLabel: string;
  noneLabel: string;
  addLabel: string;
}) {
  const router = useRouter();
  const hrefFor = (ids: string[]) => overviewHref({ ...params, [paramName]: ids.join(",") });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    router.push(hrefFor(next));
  }

  const selectedNames = options.filter((o) => selectedIds.includes(o.id)).map((o) => o.name);
  const summary =
    selectedNames.length === 0
      ? label
      : selectedNames.length <= 2
        ? `${label}: ${selectedNames.join(", ")}`
        : `${label}: ${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`;

  const filtered = query.trim() ? options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())) : options;

  return (
    <div ref={ref} className="relative shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
        }}
        className={`btno text-[9px] shrink-0 flex items-center gap-1.5 cursor-pointer max-w-[240px] ${
          selectedIds.length > 0 ? "!bg-ink/10 !text-accent !border-accent/40" : ""
        }`}
      >
        <span className="truncate">{summary}</span>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(hrefFor([]));
            }}
            className="leading-none hover:text-ink"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="card absolute left-0 top-[calc(100%+6px)] z-20 w-[220px] p-2 flex flex-col gap-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.4)]">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="input !text-[11px] !py-1.5"
          />
          <div className="flex items-center justify-between px-0.5">
            <span className="heading-label !text-[9px]">{label}</span>
            <div className="flex items-center gap-2 text-[9px] tracking-[0.08em] uppercase">
              <button type="button" onClick={() => router.push(hrefFor(options.map((o) => o.id)))} className="text-accent hover:underline">
                {allLabel}
              </button>
              <button type="button" onClick={() => router.push(hrefFor([]))} className="placeholder-text hover:text-ink hover:underline">
                {noneLabel}
              </button>
            </div>
          </div>
          <div className="flex flex-col max-h-[220px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-[11px] placeholder-text px-1.5 py-2">{emptyLabel}</div>
            ) : (
              filtered.map((o) => (
                <label
                  key={o.id}
                  className="shrink-0 flex items-center gap-2 text-[12px] px-1.5 py-1.5 rounded-md hover:bg-ink/8 cursor-pointer truncate"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(o.id)}
                    onChange={() => toggle(o.id)}
                    className="shrink-0 accent-accent"
                  />
                  <span className="truncate">{o.name}</span>
                </label>
              ))
            )}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="btn !text-[10px] !py-1.5 mt-0.5">
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
