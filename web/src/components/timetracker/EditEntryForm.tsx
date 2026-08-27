"use client";

import { useActionState, useEffect, useTransition } from "react";
import { updateManualEntryAction, deleteTimeEntryAction, type TimeFormState } from "@/lib/actions/timetracker";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import type { TimePhase } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/dictionary";

const initialState: TimeFormState = {};

type T = Dictionary["timeTracker"]["editEntryForm"];
type TPhases = Dictionary["phases"];
type TDelete = Dictionary["timeTracker"]["deleteEntry"];

export function EditEntryForm({
  id,
  eventId,
  events,
  date,
  minutes,
  description,
  phase,
  startTime,
  endTime,
  onSaved,
  onCancel,
  t,
  tPhases,
  tDelete,
}: {
  id: string;
  eventId: string | null;
  events: { id: string; title: string }[];
  date: string;
  minutes: number;
  description: string;
  phase: TimePhase;
  startTime?: string;
  endTime?: string;
  onSaved: () => void;
  onCancel: () => void;
  t: T;
  tPhases: TPhases;
  tDelete: TDelete;
}) {
  const [state, formAction, pending] = useActionState(updateManualEntryAction, initialState);
  const [deleting, startDeleteTransition] = useTransition();
  const { confirm } = useConfirmDialog();
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  useEffect(() => {
    if (state.success) onSaved();
    // onSaved unmounts this form (closes the modal) once called, so it can't double-fire — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  // See DeleteEntryButton's old note (now folded in here): onClick + a direct
  // action call rather than <form action> + onSubmit-preventDefault, which raced.
  async function handleDelete() {
    const ok = await confirm(tDelete.confirmMsg, { confirmLabel: tDelete.deleteLabel });
    if (!ok) return;
    const formData = new FormData();
    formData.set("id", id);
    startDeleteTransition(() => {
      deleteTimeEntryAction(formData);
    });
    onCancel();
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.eventLabel}</span>
        <select name="eventId" defaultValue={eventId ?? ""} className="input">
          <option value="">{t.noEventOption}</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.dateLabel}</span>
        <input name="date" type="date" required defaultValue={date} className="input" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.durationLabel}</span>
        <input name="duration" type="number" min={1} defaultValue={h * 60 + m} className="input" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.startTimeOptional}</span>
          <input name="startTime" type="time" defaultValue={startTime} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{t.endTimeOptional}</span>
          <input name="endTime" type="time" defaultValue={endTime} className="input" />
        </label>
      </div>
      <span className="text-[9px] placeholder-text -mt-1">{t.recomputeHint}</span>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.phaseLabel}</span>
        <select name="phase" defaultValue={phase} className="input">
          {Object.entries(tPhases).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{t.descriptionLabel}</span>
        <input name="description" defaultValue={description} className="input" />
      </label>

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

      <div className="flex gap-2 items-center">
        <button type="submit" disabled={pending} className="btn">
          {pending ? t.saving : t.saveChanges}
        </button>
        <button type="button" onClick={onCancel} className="btno">
          {t.cancel}
        </button>
        <button type="button" disabled={deleting} onClick={handleDelete} className="btno text-warning ml-auto">
          {deleting ? tDelete.deletingLabel : tDelete.deleteLabel}
        </button>
      </div>
    </form>
  );
}
