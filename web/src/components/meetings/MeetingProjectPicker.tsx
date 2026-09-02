"use client";

import { useState } from "react";

/**
 * Multi-select of projects for the meeting form. Same chip-toggle pattern as
 * TeamPicker (projects/TeamPicker.tsx). Emits one hidden `projectIds` input per
 * selected project; the create/update actions sync MeetingProject rows from those.
 */
export function MeetingProjectPicker({
  options,
  defaultValue,
  heading,
  note,
  emptyLabel,
}: {
  options: { id: string; title: string }[];
  defaultValue: string[];
  heading: string;
  note: string;
  emptyLabel: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);

  return (
    <div>
      <div className="heading-label !text-[12px] mb-1.5">{heading}</div>
      <p className="text-[10px] placeholder-text mb-2">{note}</p>
      {selected.map((id) => (
        <input key={id} type="hidden" name="projectIds" value={id} />
      ))}
      <div className="flex flex-wrap gap-2">
        {options.map((e) => {
          const on = selected.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelected((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id]))}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                on ? "border-accent/50 bg-accent/10 text-accent" : "border-ink/15 text-ink/65 hover:text-ink"
              }`}
            >
              {e.title}
            </button>
          );
        })}
        {options.length === 0 && <span className="text-[11px] placeholder-text">{emptyLabel}</span>}
      </div>
    </div>
  );
}
