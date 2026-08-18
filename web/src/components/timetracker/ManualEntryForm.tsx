"use client";

import { useActionState } from "react";
import { addManualEntryAction, type TimeFormState } from "@/lib/actions/timetracker";
import { PHASE_LABEL } from "@/lib/time-phases";

const initialState: TimeFormState = {};

export function ManualEntryForm({ events }: { events: { id: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState(addManualEntryAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <div className="label">Manual entry</div>
      <select name="eventId" required defaultValue="" className="input">
        <option value="" disabled>
          Event…
        </option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>
      <div className="flex gap-1.5">
        <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input flex-1" />
        <input name="duration" type="number" min={1} placeholder="mins" className="input w-[70px]" />
      </div>
      <div className="flex gap-1.5">
        <input name="startTime" type="time" className="input flex-1" />
        <input name="endTime" type="time" className="input flex-1" />
      </div>
      <select name="phase" defaultValue="PLANNING" className="input">
        {Object.entries(PHASE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <input name="description" placeholder="What was done" className="input" />
      {state.error && <p className="text-[11px] text-warning">{state.error}</p>}
      <button type="submit" disabled={pending} className="btno">
        {pending ? "Adding…" : "Add entry"}
      </button>
      <div className="text-[9px] placeholder-text">Fill start/end time, or a duration in minutes if you don&apos;t know the exact times.</div>
    </form>
  );
}
