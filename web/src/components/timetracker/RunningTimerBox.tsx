"use client";

import { useEffect, useState } from "react";
import { startTimerAction, assignRunningTimerEventAction, assignRunningTimerPhaseAction } from "@/lib/actions/timetracker";
import type { TimePhase } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { EditableElapsedTime } from "@/components/timetracker/EditableElapsedTime";
import { useStopTimerAction } from "@/hooks/useStopTimerAction";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Running = {
  id: string;
  description: string;
  phase: TimePhase;
  startedAt: Date;
  event: { id: string; title: string; companyName: string } | null;
} | null;

const pillClass = "input !rounded-full !border-dashed !py-1.5 text-[11px] min-w-0";

/**
 * Minimal single-row timer bar (per docs/ERROR/timer-*.png reference) —
 * intentionally has no Task/Tag/$ chips, those are Toggl-specific concepts
 * this app doesn't have. Event/Phase are always-visible dashed pills: a
 * plain <select> feeding startTimerAction while idle, or their own
 * auto-submitting form (assignRunningTimerEventAction/PhaseAction) while
 * running, so either can be reassigned in place without stopping the timer.
 * `compact` stacks the same elements vertically for the narrow List-view
 * sidebar column instead of laying them out in one row.
 */
export function RunningTimerBox({
  running,
  events,
  locale,
  compact = false,
}: {
  running: Running;
  events: { id: string; title: string; companyName: string }[];
  locale: Locale;
  compact?: boolean;
}) {
  const t = getDictionary(locale).timeTracker.runningTimer;
  const tPhases = getDictionary(locale).phases;
  const [now, setNow] = useState(() => Date.now());
  const { formAction: stopFormAction } = useStopTimerAction(t.discardedTooShort);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Non-compact still stacks vertically below `sm` — the one-row layout only
  // has room for the description input + two select pills + timer + button
  // once there's ~600px to work with; narrower than that and the description
  // field collapses to an unusable sliver (mobile-review finding).
  const wrapClass = compact
    ? "card p-3.5 flex flex-col gap-2.5"
    : "card px-4 py-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3 sm:flex-wrap";
  const pillWidth = compact ? "w-full" : "w-full sm:w-auto";
  const elapsedLabel = formatElapsed(running ? now - running.startedAt.getTime() : 0);

  const eventOptions = (
    <>
      <option value="">{t.assignEvent}</option>
      {events.map((e) => (
        <option key={e.id} value={e.id}>
          {e.title}
        </option>
      ))}
    </>
  );

  const phaseOptions = Object.entries(tPhases).map(([v, l]) => (
    <option key={v} value={v}>
      {l}
    </option>
  ));

  if (!running) {
    return (
      <div className={wrapClass}>
        <form action={startTimerAction} className="contents">
          <input
            name="description"
            placeholder={t.whatWorkingOn}
            className={`bg-transparent outline-none text-[15px] font-semibold placeholder:text-ink/40 placeholder:font-normal min-w-0 ${compact ? "w-full" : "w-full sm:flex-1"}`}
          />
          <select name="eventId" defaultValue="" className={`${pillClass} ${pillWidth}`}>
            {eventOptions}
          </select>
          <select name="phase" defaultValue="PLANNING" className={`${pillClass} ${pillWidth}`}>
            {phaseOptions}
          </select>
          <div className={`flex items-center gap-2.5 shrink-0 ${compact ? "w-full justify-between" : "w-full justify-between sm:w-auto"}`}>
            <span className="placeholder-text text-[15px] font-semibold tabular-nums px-1">{elapsedLabel}</span>
            <button
              type="submit"
              title={t.start}
              className="w-10 h-10 rounded-full bg-accent flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
            >
              <PlayIcon />
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <form id="stop-form" action={stopFormAction} className="hidden" />
      <input
        name="description"
        defaultValue={running.description}
        placeholder={t.whatWorkingOn}
        form="stop-form"
        className={`bg-transparent outline-none text-[15px] font-semibold placeholder:text-ink/40 placeholder:font-normal min-w-0 ${compact ? "w-full" : "w-full sm:flex-1"}`}
      />
      <form action={assignRunningTimerEventAction} className={pillWidth}>
        <select
          name="eventId"
          defaultValue={running.event?.id ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={`${pillClass} ${pillWidth}`}
        >
          {eventOptions}
        </select>
      </form>
      <form action={assignRunningTimerPhaseAction} className={pillWidth}>
        <select
          name="phase"
          defaultValue={running.phase}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={`${pillClass} ${pillWidth}`}
        >
          {phaseOptions}
        </select>
      </form>
      <div className={`flex items-center gap-2.5 shrink-0 ${compact ? "w-full justify-between" : "w-full justify-between sm:w-auto"}`}>
        <EditableElapsedTime
          elapsedLabel={elapsedLabel}
          startedAt={running.startedAt}
          t={getDictionary(locale).timeTracker.editableElapsed}
          className="text-[15px] font-semibold tabular-nums border border-ink/25 rounded-lg px-3 py-1.5"
        />
        <button
          type="submit"
          form="stop-form"
          title={t.stop}
          className="timer-pulse w-10 h-10 rounded-full bg-warning flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
        >
          <StopIcon />
        </button>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24">
      <path d="M7 4v16l14-8Z" fill="currentColor" className="text-ink" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" className="text-ink" />
    </svg>
  );
}
