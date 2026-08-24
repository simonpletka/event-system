"use client";

import { useActionState, useRef, type ChangeEvent } from "react";
import { addManualEntryAction, type TimeFormState } from "@/lib/actions/timetracker";
import { isoDate } from "@/lib/calendar";
import type { Dictionary } from "@/lib/dictionary";

const initialState: TimeFormState = {};

type T = Dictionary["timeTracker"]["manualForm"];
type TPhases = Dictionary["phases"];

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function addMinutes(time: string, minutesToAdd: number) {
  const total = (toMinutes(time) + minutesToAdd + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function ManualEntryForm({ events, t, tPhases }: { events: { id: string; title: string }[]; t: T; tPhases: TPhases }) {
  const [state, formAction, pending] = useActionState(addManualEntryAction, initialState);
  const endTimeRef = useRef<HTMLInputElement>(null);

  /**
   * Whenever start time changes, keep end time later than it: if end is
   * still empty, or the previously-set end no longer comes after the new
   * start, default it to start + 30min. A user-set end that's already
   * later than the new start is left alone.
   */
  function handleStartTimeChange(e: ChangeEvent<HTMLInputElement>) {
    const start = e.target.value;
    if (!start || !endTimeRef.current) return;
    const end = endTimeRef.current.value;
    if (!end || toMinutes(end) <= toMinutes(start)) {
      endTimeRef.current.value = addMinutes(start, 30);
    }
  }

  return (
    <div className="card p-5">
      <div className="heading-label !text-[12px] mb-2">{t.addManualEntry}</div>
      <form action={formAction} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.eventLabel}</span>
          <select name="eventId" required defaultValue="" className="input">
            <option value="" disabled>
              {t.selectEvent}
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.dateLabel}</span>
          <input name="date" type="date" required defaultValue={isoDate(new Date())} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.phaseLabel}</span>
          <select name="phase" defaultValue="PLANNING" className="input">
            {Object.entries(tPhases).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.startTimeLabel}</span>
          <input name="startTime" type="time" className="input" onChange={handleStartTimeChange} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.endTimeLabel}</span>
          <input ref={endTimeRef} name="endTime" type="time" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.orDurationLabel}</span>
          <input name="duration" type="number" min={1} placeholder={t.minsPlaceholder} className="input" />
        </label>

        <label className="md:col-span-2 flex flex-col gap-1.5">
          <span className="heading-label">{t.descriptionLabel}</span>
          <input name="description" placeholder={t.descriptionPlaceholder} className="input" />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={pending} className="btn w-full">
            {pending ? t.adding : t.addEntry}
          </button>
        </div>
      </form>
      {state.error && <p className="text-[11px] text-warning mt-2">{state.error}</p>}
      <div className="label mt-2">{t.fillHint}</div>
    </div>
  );
}
