"use client";

import { useActionState, useEffect, useRef, type CSSProperties } from "react";
import { addCalendarEntryAction, type TimeFormState } from "@/lib/actions/timetracker";
import { isoDate } from "@/lib/calendar";
import type { Dictionary } from "@/lib/dictionary";

const initialState: TimeFormState = {};

type T = Dictionary["timeTracker"]["createEntryPopover"];
type TPhases = Dictionary["phases"];

function minutesToTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Opened after a click-drag on the calendar's hourly grid (see
 * TimeTrackerCalendar's draw-to-create handlers). `style` positions this as
 * a `position: fixed` overlay near the drawn block — fixed rather than
 * nested inside the scrollable grid, since that scroll container's
 * overflow-y:auto silently promotes overflow-x to auto too (see the
 * documented CSS gotcha) and would clip a popover extending past the column.
 */
export function CreateEntryPopover({
  day,
  startMin,
  endMin,
  style,
  events,
  t,
  tPhases,
  onClose,
}: {
  day: Date;
  startMin: number;
  endMin: number;
  style: CSSProperties;
  events: { id: string; title: string }[];
  t: T;
  tPhases: TPhases;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(addCalendarEntryAction, initialState);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (state.success) onClose();
    // onClose unmounts this popover once called, so it can't double-fire — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const duration = endMin - startMin;

  return (
    <div ref={ref} style={style} className="fixed z-40 card p-4 w-[260px] shadow-[0_14px_36px_rgba(0,0,0,0.4)]">
      <form action={formAction} className="flex flex-col gap-2.5">
        <input type="hidden" name="date" value={isoDate(day)} />
        <input name="description" placeholder={t.descriptionPlaceholder} className="input" autoFocus />
        <div className="flex gap-2">
          <select name="eventId" defaultValue="" className="input !rounded-full !border-dashed text-[11px] flex-1 min-w-0">
            <option value="">{t.noEventOption}</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <select name="phase" defaultValue="PLANNING" className="input !rounded-full !border-dashed text-[11px] flex-1 min-w-0">
            {Object.entries(tPhases).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <input name="startTime" type="time" defaultValue={minutesToTime(startMin)} className="input !text-[11px] !py-1.5 min-w-0" />
          <span className="placeholder-text text-[11px]">→</span>
          <input name="endTime" type="time" defaultValue={minutesToTime(endMin)} className="input !text-[11px] !py-1.5 min-w-0" />
        </div>
        <div className="label">{t.duration(Math.floor(duration / 60), duration % 60)}</div>
        {state.error && <p className="text-[11px] text-warning">{state.error}</p>}
        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={pending} className="btn flex-1">
            {pending ? t.adding : t.addEntry}
          </button>
          <button type="button" onClick={onClose} className="btno">
            {t.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
