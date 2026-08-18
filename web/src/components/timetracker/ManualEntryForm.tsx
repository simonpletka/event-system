"use client";

import { useActionState } from "react";
import { addManualEntryAction, type TimeFormState } from "@/lib/actions/timetracker";
import { PHASE_LABEL } from "@/lib/time-phases";
import { isoDate } from "@/lib/calendar";

const initialState: TimeFormState = {};

export function ManualEntryForm({ events }: { events: { id: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState(addManualEntryAction, initialState);

  return (
    <div className="card p-5">
      <div className="heading-label mb-2">Add a manual entry</div>
      <form action={formAction} className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Event</span>
          <select name="eventId" required defaultValue="" className="input">
            <option value="" disabled>
              Select an event…
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Date</span>
          <input name="date" type="date" required defaultValue={isoDate(new Date())} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Phase</span>
          <select name="phase" defaultValue="PLANNING" className="input">
            {Object.entries(PHASE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Start time</span>
          <input name="startTime" type="time" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">End time</span>
          <input name="endTime" type="time" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Or duration (mins)</span>
          <input name="duration" type="number" min={1} placeholder="mins" className="input" />
        </label>

        <label className="col-span-2 flex flex-col gap-1.5">
          <span className="heading-label">Description</span>
          <input name="description" placeholder="What was done" className="input" />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={pending} className="btn w-full">
            {pending ? "Adding…" : "Add entry"}
          </button>
        </div>
      </form>
      {state.error && <p className="text-[11px] text-warning mt-2">{state.error}</p>}
      <div className="label mt-2">Fill start/end time, or a duration in minutes if you don&apos;t know the exact times.</div>
    </div>
  );
}
