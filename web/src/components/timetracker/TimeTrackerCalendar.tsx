"use client";

import { useEffect, useRef, useState } from "react";
import { dayHeaderLabel, isSameDay, isoDate, isoTime, weekDays, assignColumns, overlapBoxStyle } from "@/lib/calendar";
import { formatMinutes } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { EditEntryButton } from "@/components/timetracker/EditEntryButton";
import { CreateEntryPopover } from "@/components/timetracker/CreateEntryPopover";
import type { TimePhase } from "@/generated/prisma/enums";

export type CalendarTimeEntry = {
  id: string;
  eventId: string | null;
  date: Date;
  minutes: number;
  description: string;
  phase: TimePhase;
  startedAt: Date | null;
  endedAt: Date | null;
  event: { id: string; title: string } | null;
};

// The grid itself covers the full day, scrollable — DEFAULT_VIEW_* just
// controls the visible window and initial scroll position on load, not what
// exists in the grid (an entry can still be drawn outside 8–18 by scrolling
// first, it's just not what's on screen by default). Mirrors WeekCalendar's
// identical scrollable-grid-with-a-default-window pattern.
const GRID_START_HOUR = 0;
const GRID_END_HOUR = 24;
const DEFAULT_VIEW_START_HOUR = 8;
const DEFAULT_VIEW_END_HOUR = 18;
const HOUR_PX = 54;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;
const VISIBLE_VIEWPORT_HEIGHT = (DEFAULT_VIEW_END_HOUR - DEFAULT_VIEW_START_HOUR) * HOUR_PX;

function minutesFromGridStart(d: Date) {
  const min = d.getHours() * 60 + d.getMinutes() - GRID_START_HOUR * 60;
  return Math.min(Math.max(min, 0), (GRID_END_HOUR - GRID_START_HOUR) * 60);
}

function snapMinutesFromOffsetY(offsetY: number) {
  const raw = GRID_START_HOUR * 60 + (offsetY / HOUR_PX) * 60;
  return Math.min(Math.max(Math.round(raw / 15) * 15, GRID_START_HOUR * 60), GRID_END_HOUR * 60);
}

type Draft = { dayIdx: number; startMin: number; endMin: number; clientX: number; clientY: number };

export function TimeTrackerCalendar({
  weekStart,
  entries,
  events,
  locale,
}: {
  weekStart: Date;
  entries: CalendarTimeEntry[];
  events: { id: string; title: string }[];
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.timeTracker.calendarView;
  const unassignedLabel = dict.timeTracker.unassignedEvent;

  function toEditable(e: CalendarTimeEntry) {
    return {
      id: e.id,
      eventId: e.eventId,
      date: isoDate(e.date),
      minutes: e.minutes,
      description: e.description,
      phase: e.phase,
      startTime: e.startedAt ? isoTime(e.startedAt) : undefined,
      endTime: e.endedAt ? isoTime(e.endedAt) : undefined,
    };
  }

  const days = weekDays(weekStart);
  const today = new Date();
  const todayIdx = days.findIndex((d) => isSameDay(d, today));
  const [selectedIdx, setSelectedIdx] = useState(todayIdx >= 0 ? todayIdx : 0);
  const selectedDay = days[selectedIdx];
  const scheduled = entries.filter((e) => e.startedAt);
  const unscheduled = entries.filter((e) => !e.startedAt);

  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);

  const selectedUnscheduled = unscheduled.filter((e) => isSameDay(e.date, selectedDay));
  const selectedScheduled = scheduled
    .filter((e) => isSameDay(e.date, selectedDay))
    .sort((a, b) => a.startedAt!.getTime() - b.startedAt!.getTime());

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: DEFAULT_VIEW_START_HOUR * HOUR_PX });
  }, [weekStart]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragAnchorRef = useRef<{ dayIdx: number; anchorMin: number; top: number } | null>(null);

  function handleColumnMouseDown(e: React.MouseEvent<HTMLDivElement>, dayIdx: number) {
    if (e.target !== e.currentTarget) return; // clicked an existing entry block, not empty grid
    const rect = e.currentTarget.getBoundingClientRect();
    const anchorMin = snapMinutesFromOffsetY(e.clientY - rect.top);
    dragAnchorRef.current = { dayIdx, anchorMin, top: rect.top };
    setDragging(true);
    setDraft({ dayIdx, startMin: anchorMin, endMin: Math.min(anchorMin + 30, GRID_END_HOUR * 60), clientX: e.clientX, clientY: e.clientY });

    function onMove(ev: MouseEvent) {
      const anchor = dragAnchorRef.current;
      if (!anchor) return;
      const curMin = snapMinutesFromOffsetY(ev.clientY - anchor.top);
      const start = Math.min(anchor.anchorMin, curMin);
      const end = Math.max(anchor.anchorMin, curMin, start + 15);
      setDraft({ dayIdx: anchor.dayIdx, startMin: start, endMin: end, clientX: ev.clientX, clientY: ev.clientY });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      dragAnchorRef.current = null;
      setDragging(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const popoverStyle = draft
    ? {
        top: Math.min(draft.clientY, window.innerHeight - 340),
        left: draft.dayIdx >= 4 ? undefined : Math.min(draft.clientX + 12, window.innerWidth - 280),
        right: draft.dayIdx >= 4 ? Math.max(window.innerWidth - draft.clientX + 12, 16) : undefined,
      }
    : null;

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
            <EditEntryButton
              key={e.id}
              entry={toEditable(e)}
              events={events}
              modalTitle={dict.timeTracker.entryEdit.editEntry}
              t={dict.timeTracker.editEntryForm}
              tPhases={dict.phases}
              tDelete={dict.timeTracker.deleteEntry}
              className="card w-full flex items-center gap-2.5 px-3.5 py-3 text-left"
            >
              <span className="w-[3px] self-stretch rounded bg-ink/30" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold truncate">{(e.event?.title ?? unassignedLabel)}</div>
                {e.description && <div className="placeholder-text text-[11px] truncate">{e.description}</div>}
              </div>
              <div className="text-[12px] font-semibold shrink-0">{formatMinutes(e.minutes)}</div>
            </EditEntryButton>
          ))}

          {selectedScheduled.map((e) => (
            <EditEntryButton
              key={e.id}
              entry={toEditable(e)}
              events={events}
              modalTitle={dict.timeTracker.entryEdit.editEntry}
              t={dict.timeTracker.editEntryForm}
              tPhases={dict.phases}
              tDelete={dict.timeTracker.deleteEntry}
              className="card w-full flex items-center gap-2.5 px-3.5 py-3 text-left"
            >
              <span className="w-[3px] self-stretch rounded bg-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] font-semibold text-ink/55">
                  {String(e.startedAt!.getHours()).padStart(2, "0")}:{String(e.startedAt!.getMinutes()).padStart(2, "0")}
                </div>
                <div className="text-[13.5px] font-semibold truncate">{(e.event?.title ?? unassignedLabel)}</div>
                {e.description && <div className="placeholder-text text-[11px] truncate">{e.description}</div>}
              </div>
              <div className="text-[12px] font-semibold shrink-0">{formatMinutes(e.minutes)}</div>
            </EditEntryButton>
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
                  <EditEntryButton
                    key={e.id}
                    entry={toEditable(e)}
                    events={events}
                    modalTitle={dict.timeTracker.entryEdit.editEntry}
                    t={dict.timeTracker.editEntryForm}
                    tPhases={dict.phases}
                    tDelete={dict.timeTracker.deleteEntry}
                    title={`${(e.event?.title ?? unassignedLabel)}${e.description ? ` — ${e.description}` : ""}`}
                    className="w-full overflow-hidden rounded-md text-[8.5px] leading-tight bg-ink/14 border border-ink/25 px-1.5 py-1 truncate hover:border-accent text-left"
                  >
                    <div className="font-semibold truncate">{(e.event?.title ?? unassignedLabel)}</div>
                    <div className="placeholder-text">{formatMinutes(e.minutes)}</div>
                  </EditEntryButton>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div ref={scrollRef} className="overflow-y-auto mt-1" style={{ maxHeight: VISIBLE_VIEWPORT_HEIGHT }}>
      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))]">
        <div>
          {hours.map((h) => (
            <div key={h} className="label" style={{ height: HOUR_PX }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((day, dayIdx) => {
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
              className="relative border-l border-ink/13 cursor-crosshair"
              style={{
                height: GRID_HEIGHT,
                backgroundImage: `repeating-linear-gradient(to bottom, rgba(243,242,242,.1) 0 1px, transparent 1px ${HOUR_PX}px)`,
              }}
              onMouseDown={(e) => handleColumnMouseDown(e, dayIdx)}
            >
              {placed.map((e) => (
                <EditEntryButton
                  key={e.id}
                  entry={toEditable(e)}
                  events={events}
                  modalTitle={dict.timeTracker.entryEdit.editEntry}
                  t={dict.timeTracker.editEntryForm}
                  tPhases={dict.phases}
                  tDelete={dict.timeTracker.deleteEntry}
                  title={`${(e.event?.title ?? unassignedLabel)}${e.description ? ` — ${e.description}` : ""}`}
                  className="absolute overflow-hidden rounded-md text-[8.5px] leading-tight bg-ink/14 border border-ink/25 px-1.5 py-1 box-border hover:border-accent flex flex-col text-left shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
                  style={{
                    top: (e.startMin / 60) * HOUR_PX,
                    height: Math.max(28, ((e.endMin - e.startMin) / 60) * HOUR_PX),
                    ...overlapBoxStyle(e.col),
                  }}
                >
                  <div className="font-semibold truncate">{(e.event?.title ?? unassignedLabel)}</div>
                  {e.description && <div className="placeholder-text truncate">{e.description}</div>}
                  <div className="placeholder-text mt-auto">{formatMinutes(e.minutes)}</div>
                </EditEntryButton>
              ))}
              {draft && draft.dayIdx === dayIdx && (
                <div
                  className="absolute overflow-hidden rounded-md pointer-events-none border-2 border-dashed border-accent bg-accent/20"
                  style={{ top: (draft.startMin / 60) * HOUR_PX, height: ((draft.endMin - draft.startMin) / 60) * HOUR_PX, left: 0, right: 0 }}
                />
              )}
            </div>
          );
        })}
      </div>
      </div>
      </div>

      {entries.length === 0 && <p className="text-sm placeholder-text mt-3">{t.noTimeThisWeek}</p>}

      {draft && !dragging && popoverStyle && (
        <CreateEntryPopover
          day={days[draft.dayIdx]}
          startMin={draft.startMin}
          endMin={draft.endMin}
          style={popoverStyle}
          events={events}
          t={dict.timeTracker.createEntryPopover}
          tPhases={dict.phases}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
