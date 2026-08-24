"use client";

import { useState } from "react";
import Link from "next/link";
import { isSameDay, monthGrid, startOfDay } from "@/lib/calendar";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type SinglePicker = {
  mode: "single";
  /** The currently active day (e.g. the Monday of the displayed week). */
  active: Date;
  hrefFor: (day: Date) => string;
};

export type RangePicker = {
  mode: "range";
  rangeStart: Date;
  rangeEnd: Date;
  /** Called once both clicks have landed — `a` <= `b`. Caller navigates and closes the popover. */
  onCommit: (a: Date, b: Date) => void;
};

/**
 * Mon-first month grid popover. Single mode is plain navigation (each day a
 * Link); range mode needs two clicks staged locally before the caller can
 * compute a destination href, so those cells are buttons instead.
 */
export function MiniCalendar({ picker, initialMonth }: { picker: SinglePicker | RangePicker; initialMonth: Date }) {
  const [viewMonth, setViewMonth] = useState(() => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const [draftStart, setDraftStart] = useState<Date | null>(null);

  const today = startOfDay(new Date());
  const weeks = monthGrid(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  function handleRangeClick(day: Date) {
    if (picker.mode !== "range") return;
    if (!draftStart) {
      setDraftStart(day);
      return;
    }
    const [a, b] = [draftStart, day].sort((x, y) => x.getTime() - y.getTime());
    setDraftStart(null);
    picker.onCommit(a, b);
  }

  function cellState(day: Date): "start" | "end" | "in-range" | "none" {
    if (picker.mode !== "range") return "none";
    if (draftStart) return isSameDay(day, draftStart) ? "start" : "none";
    if (isSameDay(day, picker.rangeStart)) return "start";
    if (isSameDay(day, picker.rangeEnd)) return "end";
    if (day.getTime() > picker.rangeStart.getTime() && day.getTime() < picker.rangeEnd.getTime()) return "in-range";
    return "none";
  }

  return (
    <div className="card p-3 w-[280px] shadow-[0_14px_36px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="btno px-2 py-1"
        >
          ←
        </button>
        <div className="text-[12px] font-semibold">{monthLabel}</div>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="btno px-2 py-1"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] tracking-[0.08em] uppercase placeholder-text pb-1">
            {d}
          </div>
        ))}

        {weeks.flat().map((day) => {
          const inMonth = day.getMonth() === viewMonth.getMonth();
          const isToday = isSameDay(day, today);
          const isActive = picker.mode === "single" && isSameDay(day, picker.active);
          const state = cellState(day);

          const base = "aspect-square flex items-center justify-center text-[12px] rounded-lg transition-colors";
          const tone = !inMonth ? "text-ink/35" : "text-ink";
          const fillClass =
            isActive || state === "start" || state === "end"
              ? "bg-accent text-ink font-semibold"
              : state === "in-range"
                ? "bg-accent/15"
                : "hover:bg-ink/8";
          const ringClass = isToday && !isActive && state === "none" ? "ring-2 ring-accent ring-inset" : "";

          if (picker.mode === "single") {
            return (
              <Link
                key={day.toISOString()}
                href={picker.hrefFor(day)}
                className={`${base} ${tone} ${fillClass} ${ringClass}`}
              >
                {day.getDate()}
              </Link>
            );
          }

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleRangeClick(day)}
              className={`${base} ${tone} ${fillClass} ${ringClass}`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
