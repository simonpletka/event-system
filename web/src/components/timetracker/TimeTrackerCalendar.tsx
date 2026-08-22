"use client";

import { useState } from "react";
import Link from "next/link";
import { dayHeaderLabel, isSameDay, weekDays, assignColumns } from "@/lib/calendar";
import { formatMinutes } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/dictionary";

export type CalendarTimeEntry = {
  id: string;
  date: Date;
  minutes: number;
  description: string;
  startedAt: Date | null;
  endedAt: Date | null;
  event: { id: string; title: string };
};

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;
const HOUR_PX = 36;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;

function minutesFromGridStart(d: Date) {
  const min = d.getHours() * 60 + d.getMinutes() - GRID_START_HOUR * 60;
  return Math.min(Math.max(min, 0), (GRID_END_HOUR - GRID_START_HOUR) * 60);
}

export function TimeTrackerCalendar({ weekStart, entries, locale }: { weekStart: Date; entries: CalendarTimeEntry[]; locale: Locale }) {
  const t = getDictionary(locale).timeTracker.calendarView;
  const days = weekDays(weekStart);
  const today = new Date();
  const todayIdx = days.findIndex((d) => isSameDay(d, today));
  const [selectedIdx, setSelectedIdx] = useState(todayIdx >= 0 ? todayIdx : 0);
  const selectedDay = days[selectedIdx];
  const scheduled = entries.filter((e) => e.startedAt);
  const unscheduled = entries.filter((e) => !e.startedAt);

  const hours = Array.from({ length: (GRID_END_HOUR - GRID_START_HOUR) / 2 + 1 }, (_, i) => GRID_START_HOUR + i * 2);

  const selectedUnscheduled = unscheduled.filter((e) => isSameDay(e.date, selectedDay));
  const selectedScheduled = scheduled
    .filter((e) => isSameDay(e.date, selectedDay))
    .sort((a, b) => a.startedAt!.getTime() - b.startedAt!.getTime());

  return (
    <div>
      {/* Mobile: a 7-day strip (tap to pick a day) above a single-day agenda,
          replacing the desktop hourly grid, which can't survive a 375px viewport. */}
      <div className="md:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {days.map((d, i) => {
            const [dow, num] = dayHeaderLabel(d).split(" ");
            const isToday = isSameDay(d, today);
            const isSelected = i === selectedIdx;
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSelectedIdx(i)}
                className={`shrink-0 w-11 flex flex-col items-center gap-1 rounded-xl py-2 ${
                  isSelected ? "bg-accent text-ink" : isToday ? "text-accent" : "text-ink/60"
                }`}
              >
                <span className="text-[8.5px] tracking-[0.06em]">{dow}</span>
                <span className="text-[14px] font-semibold">{num}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {selectedUnscheduled.length > 0 && (
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink/55 mt-1">{t.unscheduled}</div>
          )}
          {selectedUnscheduled.map((e) => (
            <Link key={e.id} href={`/time-tracker/entries/${e.id}/edit`} className="card flex items-center gap-2.5 px-3.5 py-3">
              <span className="w-[3px] self-stretch rounded bg-ink/30" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold truncate">{e.event.title}</div>
                {e.description && <div className="placeholder-text text-[11px] truncate">{e.description}</div>}
              </div>
              <div className="text-[12px] font-semibold shrink-0">{formatMinutes(e.minutes)}</div>
            </Link>
          ))}

          {selectedScheduled.map((e) => (
            <Link key={e.id} href={`/time-tracker/entries/${e.id}/edit`} className="card flex items-center gap-2.5 px-3.5 py-3">
              <span className="w-[3px] self-stretch rounded bg-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] font-semibold text-ink/55">
                  {String(e.startedAt!.getHours()).padStart(2, "0")}:{String(e.startedAt!.getMinutes()).padStart(2, "0")}
                </div>
                <div className="text-[13.5px] font-semibold truncate">{e.event.title}</div>
                {e.description && <div className="placeholder-text text-[11px] truncate">{e.description}</div>}
              </div>
              <div className="text-[12px] font-semibold shrink-0">{formatMinutes(e.minutes)}</div>
            </Link>
          ))}

          {selectedUnscheduled.length === 0 && selectedScheduled.length === 0 && (
            <p className="text-sm placeholder-text">{t.noItemsThisDay}</p>
          )}
        </div>
      </div>

      <div className="hidden md:block">
      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-ink/20 pb-1">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={`heading-label text-center ${isSameDay(d, today) ? "text-accent" : ""}`}>
            {dayHeaderLabel(d)}
          </div>
        ))}
      </div>

      {unscheduled.length > 0 && (
        <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1 py-1.5 border-b-2 border-ink">
          <div className="label">{t.unscheduled}</div>
          {days.map((day) => {
            const dayEntries = unscheduled.filter((e) => isSameDay(e.date, day));
            return (
              <div key={day.toISOString()} className="flex flex-col gap-1">
                {dayEntries.map((e) => (
                  <Link
                    key={e.id}
                    href={`/time-tracker/entries/${e.id}/edit`}
                    title={`${e.event.title}${e.description ? ` — ${e.description}` : ""}`}
                    className="overflow-hidden text-[8.5px] leading-tight bg-ink/14 border border-ink/25 px-1.5 py-1 truncate hover:border-accent"
                  >
                    <div className="font-semibold truncate">{e.event.title}</div>
                    <div className="placeholder-text">{formatMinutes(e.minutes)}</div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] mt-1">
        <div>
          {hours.map((h) => (
            <div key={h} className="label" style={{ height: HOUR_PX * 2 }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dayEntries = scheduled.filter((e) => isSameDay(e.date, day));
          const placed = assignColumns(
            dayEntries.map((e) => ({
              ...e,
              startMin: minutesFromGridStart(e.startedAt!),
              endMin: minutesFromGridStart(e.endedAt ?? new Date(e.startedAt!.getTime() + e.minutes * 60000)),
            }))
          );
          return (
            <div
              key={day.toISOString()}
              className="relative border-l border-ink/13"
              style={{
                height: GRID_HEIGHT,
                backgroundImage: `repeating-linear-gradient(to bottom, rgba(243,242,242,.1) 0 1px, transparent 1px ${HOUR_PX * 2}px)`,
              }}
            >
              {placed.map((e) => (
                <Link
                  key={e.id}
                  href={`/time-tracker/entries/${e.id}/edit`}
                  title={`${e.event.title}${e.description ? ` — ${e.description}` : ""}`}
                  className="absolute overflow-hidden text-[8.5px] leading-tight bg-ink/14 border border-ink/25 px-1.5 py-1 box-border hover:border-accent flex flex-col"
                  style={{
                    top: (e.startMin / 60) * HOUR_PX,
                    height: Math.max(28, ((e.endMin - e.startMin) / 60) * HOUR_PX),
                    left: `${(e.col / e.cols) * 100}%`,
                    width: `${100 / e.cols}%`,
                  }}
                >
                  <div className="font-semibold truncate">{e.event.title}</div>
                  {e.description && <div className="placeholder-text truncate">{e.description}</div>}
                  <div className="placeholder-text mt-auto">{formatMinutes(e.minutes)}</div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      </div>

      {entries.length === 0 && <p className="text-sm placeholder-text mt-3">{t.noTimeThisWeek}</p>}
    </div>
  );
}
