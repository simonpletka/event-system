"use client";

import { useEffect, useState } from "react";
import { startTimerAction, assignRunningTimerProjectAction } from "@/lib/actions/timetracker";
import { EditableElapsedTime } from "@/components/timetracker/EditableElapsedTime";
import { useStopTimerAction } from "@/hooks/useStopTimerAction";
import type { Dictionary } from "@/lib/dictionary";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type T = {
  myTracker: string;
  noTimerRunning: string;
  stopTimer: string;
  quickStart: string;
  assignProjectOption: string;
};

type Running = { projectId: string | null; projectTitle: string | null; startedAt: string } | null;

export function TimerWidget({
  running,
  projects,
  t,
  tElapsed,
  discardedMessage,
}: {
  running: Running;
  projects: { id: string; title: string }[];
  t: T;
  tElapsed: Dictionary["timeTracker"]["editableElapsed"];
  discardedMessage: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const { formAction: stopFormAction } = useStopTimerAction(discardedMessage);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) {
    return (
      <div className="card px-3.5 py-3 flex flex-col gap-1">
        <div className="heading-label">{t.myTracker}</div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm placeholder-text">{t.noTimerRunning}</div>
          <form action={startTimerAction}>
            <button
              type="submit"
              title={t.quickStart}
              className="w-[27px] h-[27px] rounded-lg bg-accent flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 24 24">
                <path d="M7 4v16l14-8Z" fill="currentColor" className="text-ink" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const elapsed = now - new Date(running.startedAt).getTime();
  const startedAt = new Date(running.startedAt);

  return (
    <div className="card px-3.5 py-3 flex flex-col gap-2">
      <div className="heading-label">{t.myTracker}</div>
      {running.projectTitle ? (
        <div className="label truncate">{running.projectTitle}</div>
      ) : (
        <form action={assignRunningTimerProjectAction}>
          <select
            name="projectId"
            defaultValue=""
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="input !rounded-full !border-dashed !py-1 text-[10.5px] w-full"
          >
            <option value="" disabled>
              {t.assignProjectOption}
            </option>
            {projects.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </form>
      )}
      <div className="flex items-center justify-between">
        <EditableElapsedTime
          elapsedLabel={formatElapsed(elapsed)}
          startedAt={startedAt}
          t={tElapsed}
          className="text-lg font-semibold tabular-nums tracking-tight"
        />
        <form action={stopFormAction}>
          <button
            type="submit"
            title={t.stopTimer}
            className="w-[27px] h-[27px] rounded-lg border border-ink/20 bg-ink/5 flex items-center justify-center hover:bg-ink/10 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" className="text-ink/85" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
