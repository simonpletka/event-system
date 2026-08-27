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
        className={`btno text-[9px] shrink-0 flex items-center gap-1.5 cursor-pointer max-w-[220px] ${
          value ? "!bg-ink/10 !text-accent !border-accent/40" : ""
        }`}
      >
        <span className="truncate">{summary}</span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(hrefFor(""));
            }}
            className="leading-none hover:text-ink"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="card absolute left-0 top-[calc(100%+6px)] z-20 w-[220px] p-2.5 flex flex-col gap-2 shadow-[0_14px_36px_rgba(0,0,0,0.4)]">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            placeholder={placeholder}
            className="input !text-[11px] !py-1.5"
          />
          <button type="button" onClick={commit} className="btn !text-[10px] !py-1.5">
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
