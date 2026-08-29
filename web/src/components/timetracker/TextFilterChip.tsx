"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { overviewHref, type OverviewUrlParams } from "@/lib/timetracker-report-url";

/**
 * Toggl's "Description contains…" filter: a chip that opens a small panel
 * with a text input and an explicit Add — unlike FilterChip's checkboxes,
 * free text only navigates on submit, not per keystroke.
 *
 * Same RSC constraint as FilterChip: takes the other params as plain data
 * instead of a `hrefFor` closure.
 */
export function TextFilterChip({
  label,
  value,
  params,
  placeholder,
  addLabel,
}: {
  label: string;
  value: string;
  params: OverviewUrlParams;
  placeholder: string;
  addLabel: string;
}) {
  const router = useRouter();
  const hrefFor = (q: string) => overviewHref({ ...params, q });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  function openPanel() {
    setDraft(value);
    setOpen(true);
  }

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

  function commit() {
    router.push(hrefFor(draft));
    setOpen(false);
  }

  const summary = value ? `${label}: ${value}` : label;

  return (
    <div ref={ref} className="relative shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (open) setOpen(false);
          else openPanel();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (open) setOpen(false);
          else openPanel();
        }}
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full border px-3 py-1.5 cursor-pointer transition-colors max-w-[220px] ${
          value
            ? "border-accent/45 bg-accent/8 text-accent"
            : open
              ? "border-ink/35 text-ink"
              : "border-ink/13 text-ink/78 hover:border-ink/30 hover:text-ink"
        }`}
      >
        <span className="truncate">{summary}</span>
        {value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(hrefFor(""));
            }}
            aria-label="Clear"
            className="shrink-0 -mr-0.5 leading-none opacity-70 hover:opacity-100"
          >
            ×
          </button>
        ) : (
          <svg
            width="9"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className={`shrink-0 opacity-55 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        )}
      </div>
      {open && (
        <div className="card absolute left-0 top-[calc(100%+6px)] z-30 w-[240px] p-1.5 flex flex-col gap-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.5)]">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            placeholder={placeholder}
            className="input !text-[12px] !py-2 !rounded-full"
          />
          <button type="button" onClick={commit} className="btn !text-[10px] !py-2">
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
