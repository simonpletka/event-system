"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isSameDay, isoDate, monthGrid, parseIsoDate, startOfDay } from "@/lib/calendar";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MINUTE_STEP = 5;

/**
 * Themed replacement for `<input type="date">` / `<input type="datetime-local">`.
 * The value string keeps the same shape the server actions already expect:
 * "YYYY-MM-DD" without time, "YYYY-MM-DDTHH:mm" with. A hidden input carries it
 * into the form. Works controlled (`value` + `onChange`) or uncontrolled
 * (`defaultValue`). Keyboard: the trigger opens on Enter/Space, arrow keys move
 * within the month grid, Escape closes.
 */
export function DateTimeField({
  name,
  withTime = false,
  value,
  defaultValue = "",
  onChange,
  required,
  placeholder,
  className = "",
}: {
  name: string;
  withTime?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const { datePart, timePart } = splitValue(current, withTime);
  const selectedDate = datePart ? parseIsoDate(datePart) : null;
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(selectedDate ?? new Date()));

  function toggleOpen() {
    if (!open) {
      // Re-anchor the visible month, and flip the popover if it would spill
      // off the right edge of the viewport.
      if (selectedDate) setViewMonth(firstOfMonth(selectedDate));
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) setAlignRight(rect.left + 280 > window.innerWidth);
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(nextDate: string, nextTime: string) {
    const next = !nextDate ? "" : withTime ? `${nextDate}T${nextTime || "09:00"}` : nextDate;
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  function pickDay(day: Date) {
    commit(isoDate(day), timePart);
    if (!withTime) setOpen(false);
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const delta = deltas[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const from = selectedDate ?? new Date();
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + delta);
    setViewMonth(firstOfMonth(to));
    commit(isoDate(to), timePart);
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>('[data-selected="true"]')?.focus();
    });
  }

  const today = startOfDay(new Date());
  const weeks = monthGrid(viewMonth);
  const [hh, mm] = (timePart || "09:00").split(":");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-required={required || undefined}
        aria-labelledby={labelId}
        onClick={toggleOpen}
        className={`input w-full text-left flex items-center justify-between gap-2 ${className}`}
      >
        <span id={labelId} className={current ? "" : "placeholder-text"}>
          {current ? formatDisplay(selectedDate, withTime ? timePart : null) : placeholder || (withTime ? "Pick date & time" : "Pick a date")}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
          <rect x="3" y="4.5" width="18" height="17" rx="2" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        </svg>
      </button>

      {/* Submitted value — the form only ever sees this. Required is enforced
          server-side (the trigger button can't carry HTML validation). */}
      <input type="hidden" name={name} value={current} />

      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className={`card absolute z-40 mt-1 p-3 w-[268px] shadow-[0_14px_40px_rgba(0,0,0,0.45)] ${alignRight ? "right-0" : "left-0"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="btno px-2 py-1">
              ←
            </button>
            <div className="text-[12px] font-semibold">
              {viewMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </div>
            <button type="button" onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="btno px-2 py-1">
              →
            </button>
          </div>

          <div ref={gridRef} className="grid grid-cols-7 gap-y-1" onKeyDown={onGridKeyDown}>
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[9px] tracking-[0.08em] uppercase placeholder-text pb-1">
                {d}
              </div>
            ))}
            {weeks.flat().map((day) => {
              const inMonth = day.getMonth() === viewMonth.getMonth();
              const isSel = selectedDate ? isSameDay(day, selectedDate) : false;
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  data-selected={isSel}
                  tabIndex={isSel || (!selectedDate && isToday) ? 0 : -1}
                  onClick={() => pickDay(day)}
                  className={`aspect-square flex items-center justify-center text-[12px] rounded-lg transition-colors ${
                    inMonth ? "text-ink" : "text-ink/35"
                  } ${
                    isSel ? "bg-accent text-ink font-semibold" : "hover:bg-ink/8"
                  } ${isToday && !isSel ? "ring-2 ring-accent ring-inset" : ""}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {withTime && (
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-ink/10">
              <span className="heading-label">Time</span>
              <select
                value={String(Number(hh))}
                onChange={(e) => commit(datePart || isoDate(new Date()), `${String(Number(e.target.value)).padStart(2, "0")}:${mm}`)}
                className="input py-1 flex-1"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span className="placeholder-text">:</span>
              <select
                value={String(Number(mm))}
                onChange={(e) => commit(datePart || isoDate(new Date()), `${hh}:${String(Number(e.target.value)).padStart(2, "0")}`)}
                className="input py-1 flex-1"
              >
                {Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-between mt-3">
            <button
              type="button"
              onClick={() => {
                commit("", "");
                setOpen(false);
              }}
              className="text-[10px] tracking-[0.1em] uppercase placeholder-text hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                commit(isoDate(now), `${String(now.getHours()).padStart(2, "0")}:${String(Math.floor(now.getMinutes() / MINUTE_STEP) * MINUTE_STEP).padStart(2, "0")}`);
                if (!withTime) setOpen(false);
              }}
              className="text-[10px] tracking-[0.1em] uppercase text-accent hover:opacity-70"
            >
              {withTime ? "Now" : "Today"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function splitValue(v: string, withTime: boolean): { datePart: string; timePart: string } {
  if (!v) return { datePart: "", timePart: "" };
  if (!withTime) return { datePart: v.slice(0, 10), timePart: "" };
  const [d, t] = v.split("T");
  return { datePart: d ?? "", timePart: (t ?? "").slice(0, 5) };
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatDisplay(date: Date | null, time: string | null) {
  if (!date) return "";
  const d = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return time ? `${d}, ${time}` : d;
}
