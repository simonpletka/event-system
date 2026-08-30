"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { adjustRunningTimerStartAction, type TimeFormState } from "@/lib/actions/timetracker";
import { TzOffsetField } from "@/components/ui/TzOffsetField";
import { isoDate, isoTime } from "@/lib/calendar";
import type { Dictionary } from "@/lib/dictionary";

const initialState: TimeFormState = {};

type T = Dictionary["timeTracker"]["editableElapsed"];

/**
 * Wraps a live elapsed-time readout so clicking it pops a small editor for
 * the running timer's start time — the end time can't be touched since it's
 * still running (see time-adjust.png). Shared between the sidebar
 * TimerWidget and the tracking page's RunningTimerBox (normal + compact).
 */
export function EditableElapsedTime({
  elapsedLabel,
  startedAt,
  t,
  className,
}: {
  elapsedLabel: string;
  startedAt: Date;
  t: T;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className={className} title={t.adjustStart}>
        {elapsedLabel}
      </button>
      {open && <StartTimeEditor startedAt={startedAt} t={t} onSaved={() => setOpen(false)} />}
    </div>
  );
}

function StartTimeEditor({ startedAt, t, onSaved }: { startedAt: Date; t: T; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(adjustRunningTimerStartAction, initialState);

  useEffect(() => {
    if (state.success) onSaved();
    // onSaved unmounts this editor (closes the popover) once called, so it can't double-fire — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <div className="absolute left-0 top-[calc(100%+6px)] z-40 card p-3 w-[210px] shadow-[0_14px_36px_rgba(0,0,0,0.4)]">
      <form action={formAction} className="flex flex-col gap-2">
        <TzOffsetField />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="heading-label !text-[8px]">{t.start}</span>
            <input name="startTime" type="time" defaultValue={isoTime(startedAt)} className="input !text-[11px] !py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="heading-label !text-[8px]">{t.stop}</span>
            <input disabled placeholder={t.stillRunning} className="input !text-[11px] !py-1 opacity-50" />
          </label>
        </div>
        <input name="date" type="date" defaultValue={isoDate(startedAt)} className="input !text-[11px] !py-1" />
        {state.error && <p className="text-[10px] text-warning">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn text-[10px]">
          {pending ? t.saving : t.save}
        </button>
      </form>
    </div>
  );
}
