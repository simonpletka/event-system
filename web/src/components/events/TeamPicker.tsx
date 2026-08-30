"use client";

import { useState } from "react";
import { getDictionary, type Locale } from "@/lib/dictionary";

/**
 * Multi-select of team members for the event form. Same chip-toggle pattern
 * as the roadmap assignee picker (RoadmapItemModal). Emits one hidden
 * `memberIds` input per selected user; the create/update actions sync
 * `EventMember` rows from those.
 */
export function TeamPicker({
  options,
  defaultValue,
  locale,
}: {
  options: { id: string; name: string | null }[];
  defaultValue: string[];
  locale: Locale;
}) {
  const t = getDictionary(locale).events.form;
  const [selected, setSelected] = useState<string[]>(defaultValue);

  return (
    <div>
      <div className="heading-label !text-[12px] mb-1.5">{t.teamHeading}</div>
      <p className="text-[10px] placeholder-text mb-2">{t.teamNote}</p>
      {selected.map((id) => (
        <input key={id} type="hidden" name="memberIds" value={id} />
      ))}
      <div className="flex flex-wrap gap-2">
        {options.map((u) => {
          const on = selected.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelected((s) => (on ? s.filter((x) => x !== u.id) : [...s, u.id]))}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                on ? "border-accent/50 bg-accent/10 text-accent" : "border-ink/15 text-ink/65 hover:text-ink"
              }`}
            >
              {u.name ?? "—"}
            </button>
          );
        })}
        {options.length === 0 && <span className="text-[11px] placeholder-text">{t.teamEmpty}</span>}
      </div>
    </div>
  );
}
