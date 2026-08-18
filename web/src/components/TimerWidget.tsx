"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { stopTimerAction } from "@/lib/actions/timetracker";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type T = { myTracker: string; noTimerRunning: string; startOne: string; stopTimer: string };

export function TimerWidget({ running, t }: { running: { eventTitle: string; startedAt: string } | null; t: T }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) {
    return (
      <div className="card px-3.5 py-3 flex flex-col gap-1">
        <div className="heading-label">{t.myTracker}</div>
        <div className="text-sm placeholder-text">{t.noTimerRunning}</div>
        <NextLink
          href="/time-tracker"
          className="text-[9px] placeholder-text hover:text-ink underline underline-offset-2 mt-0.5 inline-block"
        >
          {t.startOne}
        </NextLink>
      </div>
    );
  }

  const elapsed = now - new Date(running.startedAt).getTime();

  return (
    <div className="card px-3.5 py-3 flex flex-col gap-2">
      <div className="heading-label">{t.myTracker}</div>
      <div className="label truncate">{running.eventTitle}</div>
      <form action={stopTimerAction} className="flex items-center justify-between">
        <div className="text-lg font-semibold tabular-nums tracking-tight">{formatElapsed(elapsed)}</div>
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
  );
}
