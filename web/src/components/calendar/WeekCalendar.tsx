"use client";

import { useEffect, useRef, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { addDays, dayHeaderLabel, isSameDay, isoWeekNumber, startOfDay, weekDays, assignColumns } from "@/lib/calendar";
import { EventStatusPill } from "@/components/StatusPill";
import { rescheduleMilestoneAction, rescheduleEventAction } from "@/lib/actions/events";
import type { EventStatus } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";

type DragPayload =
  | { type: "milestone"; milestoneId: string; eventId: string }
  | { type: "bar"; eventId: string; anchorCol: number };

export type CalendarEvent = {
  id: string;
  title: string;
  status: EventStatus;
  buildDate: Date | null;
  startDate: Date;
  endDate: Date;
  strikeDate: Date | null;
  milestones: { id: string; title: string; date: Date }[];
  venues: { address: string }[];
};

// The grid itself covers the full day, scrollable — DEFAULT_VIEW_* just
// controls the visible window and initial scroll position on load, not what
// exists in the grid (a milestone can still be dropped outside 6–20 by
// scrolling first, it's just not what's on screen by default).
const GRID_START_HOUR = 0;
const GRID_END_HOUR = 24;
const DEFAULT_VIEW_START_HOUR = 6;
const DEFAULT_VIEW_END_HOUR = 20;
const HOUR_PX = 48;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;
const VISIBLE_VIEWPORT_HEIGHT = (DEFAULT_VIEW_END_HOUR - DEFAULT_VIEW_START_HOUR) * HOUR_PX;

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

  const [, startTransition] = useTransition();
  const dragRef = useRef<DragPayload | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: DEFAULT_VIEW_START_HOUR * HOUR_PX });
  }, [weekStart]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX;
  const nowLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  /**
   * The hourly grid's day columns double as the drop target for both
   * milestones and all-day bars (dropping a bar there just moves it — the
   * vertical position only matters for a milestone). There's no separate
   * drop zone inside the all-day bar row itself; dragging a bar down a few
   * pixels into the hourly grid below its own day is the intended gesture.
   * Reschedule is limited to the 7 days currently on screen — dropping
   * outside them isn't possible since no drop target exists there.
   */
  function handleDayDragOver(e: DragEvent, dayIdx: number) {
    if (!dragRef.current) return;
    e.preventDefault();
    setDragOverIdx(dayIdx);
  }

  function handleDayDrop(e: DragEvent<HTMLDivElement>, dayIdx: number) {
    e.preventDefault();
    const drag = dragRef.current;
    dragRef.current = null;
    setDragOverIdx(null);
    if (!drag) return;

    if (drag.type === "milestone") {
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const rawMinutes = GRID_START_HOUR * 60 + (offsetY / HOUR_PX) * 60;
      const snappedMinutes = Math.min(Math.max(Math.round(rawMinutes / 15) * 15, GRID_START_HOUR * 60), GRID_END_HOUR * 60);
      const target = days[dayIdx];
      const newDate = new Date(
        target.getFullYear(),
        target.getMonth(),
        target.getDate(),
        Math.floor(snappedMinutes / 60),
        snappedMinutes % 60
      );
      const formData = new FormData();
      formData.set("milestoneId", drag.milestoneId);
      formData.set("eventId", drag.eventId);
      formData.set("date", newDate.toISOString());
      startTransition(() => {
        rescheduleMilestoneAction(formData);
      });
    } else {
      const deltaDays = dayIdx - drag.anchorCol;
      if (deltaDays === 0) return;
      const formData = new FormData();
      formData.set("id", drag.eventId);
      formData.set("deltaDays", String(deltaDays));
      startTransition(() => {
        rescheduleEventAction(formData);
      });
    }
  }

  function milestonesFor(day: Date) {
    return events.flatMap((e) => e.milestones.filter((m) => isSameDay(m.date, day)).map((m) => ({ ...m, eventId: e.id, eventTitle: e.title })));
  }

  type AllDayBar = {
    eventId: string;
    title: string;
    status: EventStatus;
    kind: "prep" | "main";
    colStart: number;
    colEnd: number;
    address?: string;
  };
  const bars: AllDayBar[] = [];
  for (const event of events) {
    const address = event.venues[0]?.address;
    const prepStart = event.buildDate ?? event.startDate;
    if (startOfDay(prepStart).getTime() < startOfDay(event.startDate).getTime()) {
      const range = clampRange(prepStart, addDays(event.startDate, -1), weekStart);
      if (range) bars.push({ eventId: event.id, title: event.title, status: event.status, kind: "prep", colStart: range[0], colEnd: range[1], address });
    }
    const mainRange = clampRange(event.startDate, event.endDate, weekStart);
    if (mainRange) bars.push({ eventId: event.id, title: event.title, status: event.status, kind: "main", colStart: mainRange[0], colEnd: mainRange[1], address });
    const strikeEnd = event.strikeDate ?? event.endDate;
    if (startOfDay(strikeEnd).getTime() > startOfDay(event.endDate).getTime()) {
      const range = clampRange(addDays(event.endDate, 1), strikeEnd, weekStart);
      if (range) bars.push({ eventId: event.id, title: event.title, status: event.status, kind: "prep", colStart: range[0], colEnd: range[1], address });
    }
  }

  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);

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
                <span className="text-[9.5px] tracking-[0.06em]">{dow}</span>
                <span className="text-[15px] font-semibold">{num}</span>
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
                <div className="text-[13.5px] font-semibold truncate">{m.eventTitle}</div>
                <div className="placeholder-text text-[11px] truncate">{m.title}</div>
              </div>
            </Link>
          ))}

          {bars.filter((bar) => selectedIdx >= bar.colStart && selectedIdx <= bar.colEnd).length === 0 &&
            milestonesFor(selectedDay).length === 0 && <p className="text-sm placeholder-text">{t.noItemsThisDay}</p>}
        </div>
      </div>

      <div className="hidden md:block">
      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-ink/20 pb-1">
        <div className="heading-label !text-[11px] !tracking-normal whitespace-nowrap">WEEK {isoWeekNumber(weekStart)}</div>
        {days.map((d) => {
          const [dow, num] = dayHeaderLabel(d).split(" ");
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className="heading-label !text-[9px] font-semibold flex items-center justify-center">
              <span
                className={`inline-flex items-center gap-1.5 !tracking-normal rounded-full ${
                  isToday ? "bg-warning text-ink px-2 py-1" : ""
                }`}
              >
                <span>{dow}</span>
                <span>{num}</span>
              </span>
            </div>
          );
        })}
      </div>

      {bars.length > 0 && (
        <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] auto-rows-[36px] gap-y-0.5 py-1.5 border-b-2 border-ink">
          <div className="label font-semibold" style={{ gridRow: 1, gridColumn: 1 }}>
            {t.allDay}
          </div>
          {bars.map((bar, i) => {
            const barKey = `bar-${i}`;
            return (
            <Link
              key={i}
              href={eventHref(bar.eventId)}
              title={bar.address ? `${bar.title} — ${bar.address}` : bar.title}
              draggable
              onDragStart={(e) => {
                dragRef.current = { type: "bar", eventId: bar.eventId, anchorCol: bar.colStart };
                setDraggingKey(barKey);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                dragRef.current = null;
                setDragOverIdx(null);
                setDraggingKey(null);
              }}
              className={`overflow-hidden px-1.5 flex flex-col justify-center gap-0.5 cursor-grab active:cursor-grabbing shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition-opacity ${
                draggingKey === barKey ? "opacity-30" : "opacity-100"
              } ${bar.kind === "main" ? "bg-accent text-ink" : "bg-ink/14"}`}
              style={{ gridRow: 1, gridColumn: `${bar.colStart + 2} / ${bar.colEnd + 3}` }}
            >
              <span className="text-[10.5px] font-bold truncate leading-tight">
                {bar.kind === "main" ? t.eventDaysBar(bar.title) : t.prepBuildBar(bar.title)}
              </span>
              {bar.address && <span className="text-[9px] font-semibold truncate leading-tight opacity-75">{bar.address}</span>}
            </Link>
            );
          })}
        </div>
      )}

      <div ref={scrollRef} className="overflow-y-auto mt-1" style={{ maxHeight: VISIBLE_VIEWPORT_HEIGHT }}>
      <div className="relative grid grid-cols-[44px_repeat(7,minmax(0,1fr))]">
        <div>
          {hours.map((h) => (
            <div key={h} className="label font-semibold" style={{ height: HOUR_PX }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((day, dayIdx) => {
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
              className={`relative border-l border-ink/13 ${dragOverIdx === dayIdx ? "bg-accent/10" : ""}`}
              style={{
                height: GRID_HEIGHT,
                backgroundImage: `repeating-linear-gradient(to bottom, rgba(243,242,242,.1) 0 1px, transparent 1px ${HOUR_PX}px)`,
              }}
              onDragOver={(e) => handleDayDragOver(e, dayIdx)}
              onDragLeave={() => setDragOverIdx((cur) => (cur === dayIdx ? null : cur))}
              onDrop={(e) => handleDayDrop(e, dayIdx)}
            >
              {placed.map((m) => {
                const milestoneKey = `milestone-${m.id}`;
                return (
                <Link
                  key={m.id}
                  href={eventHref(m.eventId)}
                  title={`${m.eventTitle}: ${m.title}`}
                  draggable
                  onDragStart={(e) => {
                    dragRef.current = { type: "milestone", milestoneId: m.id, eventId: m.eventId };
                    setDraggingKey(milestoneKey);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    dragRef.current = null;
                    setDragOverIdx(null);
                    setDraggingKey(null);
                  }}
                  className={`absolute overflow-hidden leading-tight bg-ink/22 border-2 border-ink/45 px-1 py-0.5 box-border cursor-grab active:cursor-grabbing hover:border-accent hover:bg-accent/20 shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition-opacity ${
                    draggingKey === milestoneKey ? "opacity-30" : "opacity-100"
                  }`}
                  style={{
                    top: (m.startMin / 60) * HOUR_PX,
                    height: Math.max(16, ((m.endMin - m.startMin) / 60) * HOUR_PX),
                    left: `${(m.col / m.cols) * 100}%`,
                    width: `${100 / m.cols}%`,
                  }}
                >
                  <div className="text-[10.5px] font-bold truncate">{m.eventTitle}</div>
                  <div className="placeholder-text text-[9px] font-bold truncate">{m.title}</div>
                </Link>
                );
              })}
            </div>
          );
        })}

        {todayIdx >= 0 && (
          <>
            <div
              className="absolute pointer-events-none bg-warning/70 z-10"
              style={{ top: nowTop, left: 44, right: 0, height: 1 }}
            />
            <div
              className="absolute pointer-events-none bg-warning z-10 rounded-full"
              style={{
                top: nowTop - 1,
                left: `calc(44px + (100% - 44px) * ${todayIdx} / 7)`,
                width: `calc((100% - 44px) / 7)`,
                height: 3,
              }}
            />
            <div
              className="absolute pointer-events-none bg-warning text-ink text-[10px] font-bold rounded px-1.5 py-[1px] z-20 -translate-y-1/2"
              style={{ top: nowTop, left: 2 }}
            >
              {nowLabel}
            </div>
          </>
        )}
      </div>
      </div>

      <div className="flex gap-3.5 flex-wrap mt-2.5">
        <Legend swatch="bg-accent" label={t.legendEventDays} />
        <Legend swatch="bg-ink/14" label={t.legendPrepBuild} />
        <Legend swatch="border-2 border-ink/45 bg-ink/22" label={t.legendMilestone} />
      </div>
      </div>

      {events.length === 0 && <p className="text-sm placeholder-text mt-3">{t.noEventsThisWeek}</p>}
      {events.length > 0 && (
        <div className="mt-3">
          <div className="label !text-[11px] font-bold mb-1">{t.thisWeeksEvents}</div>
          <div className="flex flex-col gap-1">
            {events.map((e) => (
              <Link key={e.id} href={eventHref(e.id)} className="flex items-center gap-2 text-[13px] hover:text-accent">
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
      <div className="label !text-[9px]">{label}</div>
    </div>
  );
}
