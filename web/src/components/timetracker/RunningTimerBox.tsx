"use client";

import { useEffect, useState } from "react";
import { startTimerAction, stopTimerAction } from "@/lib/actions/timetracker";
import type { TimePhase } from "@/generated/prisma/enums";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

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

type T = Dictionary["timeTracker"]["runningTimer"];
export function RunningTimerBox({
  running,
  events,
  locale,
}: {
  running: Running;
  events: { id: string; title: string; companyName: string }[];
  locale: Locale;
}) {
  const t = getDictionary(locale).timeTracker.runningTimer;
  const tPhases = getDictionary(locale).phases;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) {
    return (
      <div className="card p-5">
        <div className="heading-label !text-[12px] mb-2">{t.startATimer}</div>
        <form action={startTimerAction} className="grid grid-cols-1 md:grid-cols-[1fr_160px_1fr_auto] gap-3 items-end">
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">{t.eventLabel}</span>
            <select name="eventId" defaultValue="" className="input">
              <option value="">{t.noEventOption}</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
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
            <span className="heading-label">{t.descriptionLabel}</span>
            <input name="description" placeholder={t.whatWorkingOn} className="input" />
          </label>
          <button type="submit" className="btn">
            {t.start}
          </button>
        </form>
      </div>
    );
  }

  const elapsed = now - running.startedAt.getTime();
  const startedLabel = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(running.startedAt);

  return (
    <div className="card p-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_200px_auto] gap-4 md:gap-6 items-center">
      <form action={stopTimerAction} id="stop-form">
        <div className="heading-label">{t.runningOn}</div>
        <div className="text-[15px] font-semibold mt-1.5">
          {running.event ? (
            <>
              {running.event.title} <span className="placeholder-text font-normal">· {running.event.companyName}</span>
            </>
          ) : (
            <span className="placeholder-text">{t.noEventRunning}</span>
          )}
        </div>
        <input
          name="description"
          defaultValue={running.description}
          placeholder={t.whatWorkingOn}
          className="input mt-2 w-full"
          form="stop-form"
        />
        <div className="label mt-1.5">{t.descEditableHint}</div>
      </form>
      <div>
        <div className="heading-label">{t.elapsed}</div>
        <div className="text-[38px] font-semibold tracking-tight tabular-nums mt-1">{formatElapsed(elapsed)}</div>
        <div className="placeholder-text text-[11px]">{t.startedAt(startedLabel)}</div>
      </div>
      <div className="flex flex-col gap-2 w-full md:w-[150px]">
        <button type="submit" form="stop-form" className="btn">
          {t.stopAndSave}
        </button>
        <SwitchEvent events={events.filter((e) => e.id !== running.event?.id)} t={t} />
        <div className="label">{t.startingAnotherHint}</div>
      </div>
    </div>
  );
}

function SwitchEvent({ events, t }: { events: { id: string; title: string }[]; t: T }) {
  return (
    <details className="relative">
      <summary className="btno text-[9px] cursor-pointer list-none text-center">{t.switchEvent}</summary>
      <form
        action={startTimerAction}
        className="card absolute right-0 mt-1.5 p-3 z-10 w-[190px] flex flex-col gap-2 shadow-[0_14px_36px_rgba(0,0,0,0.4)]"
      >
        <select name="eventId" required defaultValue="" className="input text-[11px]">
          <option value="" disabled>
            {t.selectEvent}
          </option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <button type="submit" className="btn text-[9px]">
          {t.switch}
        </button>
      </form>
    </details>
  );
}
