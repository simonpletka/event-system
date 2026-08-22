"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, dayHeaderLabel, isSameDay, startOfDay, weekDays, assignColumns } from "@/lib/calendar";
import { EventStatusPill } from "@/components/StatusPill";
import type { EventStatus } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";

export type CalendarEvent = {
  id: string;
  title: string;
  status: EventStatus;
  buildDate: Date | null;
  startDate: Date;
  endDate: Date;
  strikeDate: Date | null;
  milestones: { id: string; title: string; date: Date }[];
};

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 21;
const HOUR_PX = 32;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;

function dayIndex(date: Date, weekStart: Date) {
  return Math.floor((startOfDay(date).getTime() - weekStart.getTime()) / 86400000);
}

function clampRange(start: Date, endInclusive: Date, weekStart: Date): [number, number] | null {
  const s = Math.max(0, dayIndex(start, weekStart));
  const e = Math.min(6, dayIndex(endInclusive, weekStart));
  if (s > e) return null;
  return [s, e];
}

function minutesFromGridStart(d: Date) {
  const min = d.getHours() * 60 + d.getMinutes() - GRID_START_HOUR * 60;
  return Math.min(Math.max(min, 0), (GRID_END_HOUR - GRID_START_HOUR) * 60);
}

export function WeekCalendar({
  weekStart,
  events,
  locale,
}: {
  weekStart: Date;
  events: CalendarEvent[];
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.calendar;
  const tStatus = dict.statusEvent;
  const eventHref = (id: string) => `/events/${id}`;
  const days = weekDays(weekStart);
  const today = new Date();
  const todayIdx = days.findIndex((d) => isSameDay(d, today));
  const [selectedIdx, setSelectedIdx] = useState(todayIdx >= 0 ? todayIdx : 0);
  const selectedDay = days[selectedIdx];

  function milestonesFor(day: Date) {
    return events.flatMap((e) => e.milestones.filter((m) => isSameDay(m.date, day)).map((m) => ({ ...m, eventId: e.id, eventTitle: e.title })));
  }

  type AllDayBar = { eventId: string; title: string; status: EventStatus; kind: "prep" | "main"; colStart: number; colEnd: number };
  const bars: AllDayBar[] = [];
  for (const event of events) {
    const prepStart = event.buildDate ?? event.startDate;
    if (startOfDay(prepStart).getTime() < startOfDay(event.startDate).getTime()) {
      const range = clampRange(prepStart, addDays(event.startDate, -1), weekStart);
      if (range) bars.push({ eventId: event.id, title: event.title, status: event.status, kind: "prep", colStart: range[0], colEnd: range[1] });
    }
    const mainRange = clampRange(event.startDate, event.endDate, weekStart);
    if (mainRange) bars.push({ eventId: event.id, title: event.title, status: event.status, kind: "main", colStart: mainRange[0], colEnd: mainRange[1] });
    const strikeEnd = event.strikeDate ?? event.endDate;
    if (startOfDay(strikeEnd).getTime() > startOfDay(event.endDate).getTime()) {
      const range = clampRange(addDays(event.endDate, 1), strikeEnd, weekStart);
      if (range) bars.push({ eventId: event.id, title: event.title, status: event.status, kind: "prep", colStart: range[0], colEnd: range[1] });
    }
  }

  const hours = Array.from({ length: (GRID_END_HOUR - GRID_START_HOUR) / 2 + 1 }, (_, i) => GRID_START_HOUR + i * 2);

  return (
    <div>
      {/* Mobile: a 7-day strip (tap to pick a day) above a single-day agenda list,
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
          {bars
            .filter((bar) => selectedIdx >= bar.colStart && selectedIdx <= bar.colEnd)
            .map((bar, i) => (
              <Link
                key={`bar-${i}`}
                href={eventHref(bar.eventId)}
                className="card flex items-center gap-2.5 px-3.5 py-3"
              >
                <span className={`w-[3px] self-stretch rounded ${bar.kind === "main" ? "bg-accent" : "bg-ink/30"}`} />
                <div className="min-w-0">
                  <div className="text-[9.5px] font-semibold text-accent">{bar.kind === "main" ? t.allDay : t.legendPrepBuild}</div>
                  <div className="text-[13.5px] font-semibold truncate">{bar.title}</div>
                </div>
              </Link>
            ))}

          {milestonesFor(selectedDay).map((m) => (
            <Link key={m.id} href={eventHref(m.eventId)} className="card flex items-center gap-2.5 px-3.5 py-3">
              <span className="w-[3px] self-stretch rounded bg-ink/30" />
              <div className="min-w-0">
                <div className="text-[9.5px] font-semibold text-ink/55">
                  {String(m.date.getHours()).padStart(2, "0")}:{String(m.date.getMinutes()).padStart(2, "0")}
                </div>
                <div className="text-[13.5px] font-semibold truncate">{m.title}</div>
                <div className="placeholder-text text-[11px] truncate">{m.eventTitle}</div>
              </div>
            </Link>
          ))}

          {bars.filter((bar) => selectedIdx >= bar.colStart && selectedIdx <= bar.colEnd).length === 0 &&
            milestonesFor(selectedDay).length === 0 && <p className="text-sm placeholder-text">{t.noItemsThisDay}</p>}
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

      {bars.length > 0 && (
        <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] auto-rows-[24px] gap-y-0.5 py-1.5 border-b-2 border-ink">
          <div className="label" style={{ gridRow: 1, gridColumn: 1 }}>
            {t.allDay}
          </div>
          {bars.map((bar, i) => (
            <Link
              key={i}
              href={eventHref(bar.eventId)}
              title={bar.title}
              className={`overflow-hidden text-[8.5px] px-1.5 flex items-center truncate ${
                bar.kind === "main" ? "bg-ink text-bg" : "bg-ink/14"
              }`}
              style={{ gridRow: 1, gridColumn: `${bar.colStart + 2} / ${bar.colEnd + 3}` }}
            >
              {bar.kind === "main" ? t.eventDaysBar(bar.title) : t.prepBuildBar(bar.title)}
            </Link>
          ))}
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
          const dayMilestones = milestonesFor(day);
          const placed = assignColumns(
            dayMilestones.map((m) => ({
              ...m,
              startMin: minutesFromGridStart(m.date),
              endMin: minutesFromGridStart(new Date(m.date.getTime() + 60 * 60000)),
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
              {placed.map((m) => (
                <Link
                  key={m.id}
                  href={eventHref(m.eventId)}
                  title={`${m.eventTitle}: ${m.title}`}
                  className="absolute overflow-hidden text-[8px] leading-tight bg-ink/14 border border-ink/25 px-1 py-0.5 box-border hover:border-accent"
                  style={{
                    top: (m.startMin / 60) * HOUR_PX,
                    height: Math.max(16, ((m.endMin - m.startMin) / 60) * HOUR_PX),
                    left: `${(m.col / m.cols) * 100}%`,
                    width: `${100 / m.cols}%`,
                  }}
                >
                  {m.title}
                  <div className="placeholder-text">{m.eventTitle}</div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3.5 flex-wrap mt-2.5">
        <Legend swatch="bg-ink" label={t.legendEventDays} />
        <Legend swatch="bg-ink/14" label={t.legendPrepBuild} />
        <Legend swatch="border border-ink/25" label={t.legendMilestone} />
      </div>
      </div>

      {events.length === 0 && <p className="text-sm placeholder-text mt-3">{t.noEventsThisWeek}</p>}
      {events.length > 0 && (
        <div className="mt-3">
          <div className="label mb-1">{t.thisWeeksEvents}</div>
          <div className="flex flex-col gap-1">
            {events.map((e) => (
              <Link key={e.id} href={eventHref(e.id)} className="flex items-center gap-2 text-[12px] hover:text-accent">
                <EventStatusPill status={e.status} t={tStatus} />
                {e.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex gap-1.5 items-center">
      <div className={`w-2.5 h-2.5 ${swatch}`} />
      <div className="label">{label}</div>
    </div>
  );
}
