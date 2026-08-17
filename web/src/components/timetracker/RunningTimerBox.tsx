"use client";

import { useEffect, useState } from "react";
import { startTimerAction, stopTimerAction } from "@/lib/actions/timetracker";
import { PHASE_LABEL } from "@/lib/time-phases";
import type { TimePhase } from "@/generated/prisma/enums";

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
  event: { id: string; title: string; companyName: string };
} | null;

export function RunningTimerBox({
  running,
  events,
}: {
  running: Running;
  events: { id: string; title: string; companyName: string }[];
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) {
    return (
      <div className="border-2 border-ink p-3">
        <div className="label mb-1.5">Start a timer</div>
        <form action={startTimerAction} className="grid grid-cols-[1fr_140px_1fr_auto] gap-2.5 items-end">
          <label className="flex flex-col gap-1">
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
          <label className="flex flex-col gap-1">
            <span className="heading-label">Phase</span>
            <select name="phase" defaultValue="PLANNING" className="input">
              {Object.entries(PHASE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="heading-label">Description</span>
            <input name="description" placeholder="What are you working on?" className="input" />
          </label>
          <button type="submit" className="btn">
            Start
          </button>
        </form>
      </div>
    );
  }

  const elapsed = now - running.startedAt.getTime();
  const startedLabel = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(running.startedAt);

  return (
    <div className="border-2 border-ink p-3 grid grid-cols-[minmax(0,1.4fr)_150px_auto] gap-3.5 items-center">
      <form action={stopTimerAction} id="stop-form">
        <div className="label">Running on</div>
        <div className="input mt-1 !border-ink text-[11px]">
          {running.event.title} <span className="placeholder-text">· {running.event.companyName}</span>
        </div>
        <input
          name="description"
          defaultValue={running.description}
          placeholder="What are you working on?"
          className="input mt-1.5"
          form="stop-form"
        />
        <div className="label mt-1">Description can be edited while the timer runs</div>
      </form>
      <div>
        <div className="label">Elapsed</div>
        <div className="text-[26px] font-semibold tracking-tight tabular-nums">{formatElapsed(elapsed)}</div>
        <div className="placeholder-text text-[9px]">started {startedLabel}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        <button type="submit" form="stop-form" className="btn">
          Stop &amp; save
        </button>
        <SwitchEvent events={events.filter((e) => e.id !== running.event.id)} />
        <div className="label">Starting another timer stops this one</div>
      </div>
    </div>
  );
}

function SwitchEvent({ events }: { events: { id: string; title: string }[] }) {
  return (
    <details className="relative">
      <summary className="btno text-[9px] cursor-pointer list-none text-center">Switch event</summary>
      <form
        action={startTimerAction}
        className="absolute right-0 mt-1 bg-surface border border-ink p-2 z-10 w-[180px] flex flex-col gap-1.5"
      >
        <select name="eventId" required defaultValue="" className="input text-[11px]">
          <option value="" disabled>
            Select an event…
          </option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <button type="submit" className="btn text-[9px]">
          Switch
        </button>
      </form>
    </details>
  );
}
