"use client";

import { useActionState } from "react";
import { updateManualEntryAction, type TimeFormState } from "@/lib/actions/timetracker";
import { PHASE_LABEL } from "@/lib/time-phases";
import { CancelLink } from "@/components/ui/CancelLink";
import type { TimePhase } from "@/generated/prisma/enums";

const initialState: TimeFormState = {};

export function EditEntryForm({
  id,
  eventTitle,
  date,
  minutes,
  description,
  phase,
}: {
  id: string;
  eventTitle: string;
  date: string;
  minutes: number;
  description: string;
  phase: TimePhase;
}) {
  const [state, formAction, pending] = useActionState(updateManualEntryAction, initialState);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return (
    <form action={formAction} className="max-w-md flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="label">Event</div>
      <div className="input opacity-60">{eventTitle}</div>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Date</span>
        <input name="date" type="date" required defaultValue={date} className="input" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Duration (minutes)</span>
        <input name="duration" type="number" min={1} defaultValue={h * 60 + m} className="input" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Start time (optional)</span>
          <input name="startTime" type="time" className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">End time (optional)</span>
          <input name="endTime" type="time" className="input" />
        </label>
      </div>
      <span className="text-[9px] placeholder-text -mt-1">Fill start/end to recompute duration precisely; otherwise the duration above is used.</span>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Phase</span>
        <select name="phase" defaultValue={phase} className="input">
          {Object.entries(PHASE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">Description</span>
        <input name="description" defaultValue={description} className="input" />
      </label>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <CancelLink href="/time-tracker/tracking" />
      </div>
    </form>
  );
}
