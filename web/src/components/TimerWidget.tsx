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

export function TimerWidget({ running }: { running: { eventTitle: string; startedAt: string } | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) {
    return (
      <div>
        <div className="heading-label mb-1.5">My timer</div>
        <div className="text-sm placeholder-text">No timer running</div>
        <NextLink
          href="/time-tracker"
          className="text-[9px] placeholder-text hover:text-ink underline underline-offset-2 mt-1 inline-block"
        >
          Start one →
        </NextLink>
      </div>
    );
  }

  const elapsed = now - new Date(running.startedAt).getTime();

  return (
    <div>
      <div className="heading-label mb-1.5">My timer</div>
      <div className="text-base font-semibold tabular-nums">{formatElapsed(elapsed)}</div>
      <div className="label truncate">{running.eventTitle}</div>
      <form action={stopTimerAction}>
        <button type="submit" className="btno mt-2 text-[9px]">
          Stop
        </button>
      </form>
    </div>
  );
}
