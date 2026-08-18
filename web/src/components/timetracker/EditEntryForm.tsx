"use client";

import { useActionState } from "react";
import { updateManualEntryAction, type TimeFormState } from "@/lib/actions/timetracker";
import { CancelLink } from "@/components/ui/CancelLink";
import type { TimePhase } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/dictionary";

const initialState: TimeFormState = {};

type T = Dictionary["timeTracker"]["editEntryForm"];
type TPhases = Dictionary["phases"];

export function EditEntryForm({
  id,
  eventTitle,
  date,
  minutes,
  description,
  phase,
  startTime,
  endTime,
  t,
  tPhases,
}: {
  id: string;
  eventTitle: string;
  date: string;
  minutes: number;
  description: string;
  phase: TimePhase;
  startTime?: string;
  endTime?: string;
  t: T;
  tPhases: TPhases;
}) {
  const [state, formAction, pending] = useActionState(updateManualEntryAction, initialState);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return (
    <form action={formAction} className="max-w-md flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="label">{t.eventLabel}</div>
      <div className="input opacity-60">{eventTitle}</div>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{t.dateLabel}</span>
        <input name="date" type="date" required defaultValue={date} className="input" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{t.durationLabel}</span>
        <input name="duration" type="number" min={1} defaultValue={h * 60 + m} className="input" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.startTimeOptional}</span>
          <input name="startTime" type="time" defaultValue={startTime} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{t.endTimeOptional}</span>
          <input name="endTime" type="time" defaultValue={endTime} className="input" />
        </label>
      </div>
      <span className="text-[9px] placeholder-text -mt-1">{t.recomputeHint}</span>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{t.phaseLabel}</span>
        <select name="phase" defaultValue={phase} className="input">
          {Object.entries(tPhases).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{t.descriptionLabel}</span>
        <input name="description" defaultValue={description} className="input" />
      </label>

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? t.saving : t.saveChanges}
        </button>
        <CancelLink href="/time-tracker/tracking" />
      </div>
    </form>
  );
}
