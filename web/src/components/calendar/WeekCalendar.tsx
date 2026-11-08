"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignColumns, assignLanes, isoWeekNumber, overlapBoxStyle, parseIsoDate } from "@/lib/calendar";
import { daysBetweenKeys, formatPragueDate, formatPragueRange, pragueDateKey, pragueInstant, pragueMinutes, shiftDateKey } from "@/lib/prague-date";
import { formatCurrency } from "@/lib/format";
import { ProjectStatusChip } from "@/components/projects/ProjectStatusChip";
import { rescheduleProjectAction } from "@/lib/actions/projects";
import { rescheduleRoadmapItemAction } from "@/lib/actions/roadmap";
import { rescheduleMeetingAction, rescheduleMeetingOccurrenceAction, splitMeetingSeriesAction } from "@/lib/actions/meetings";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { projectHref } from "@/lib/slug";

export type CalendarProject = {
  id: string;
  number: string;
  title: string;
  client: string;
  status: ProjectStatus;
  /** Excl. VAT. Null when there is none or the viewer can't see budgets. */
  value: number | null;
  place: string | null;
  address: string | null;
  editable: boolean;
  buildDate: string | null;
  startDate: string;
  endDate: string;
  strikeDate: string | null;
  milestones: { id: string; title: string; date: string; allDay: boolean }[];
};

/**
 * One already-expanded occurrence of a (possibly recurring) Meeting within
 * the displayed week — see expandMeetingOccurrences(). `originalDate` is the
 * un-shifted date this occurrence's underlying rule produced (equal to
 * `date` unless a prior drag already overrode it) — the key a reschedule
 * needs to identify which occurrence is being moved.
 */
export type CalendarMeeting = {
  id: string;
  title: string;
  date: string;
  originalDate: string;
  recurring: boolean;
  allDay: boolean;
  editable: boolean;
  projects: { number: string; title: string }[];
};

type Source =
  | { type: "project"; id: string; startDate: string; endDate: string }
  | { type: "milestone"; id: string; date: string }
  | { type: "meeting"; id: string; date: string; originalDate: string; recurring: boolean; title: string };

type Details = {
  head: string;
  title: string;
  when: string;
  where?: string | null;
  client?: string;
  status?: ProjectStatus;
  value?: number | null;
};

type BaseItem = { key: string; href: string; label: string; source: Source; editable: boolean; details: Details };
type BarItem = BaseItem & { tone: "main" | "prep" | "milestone" | "meeting"; colStart: number; colEnd: number; address?: string | null };
type LanedBar = BarItem & { lane: number };
type TimedItem = BaseItem & { tone: "milestone" | "meeting"; dayIdx: number; startMin: number; endMin: number; time: string; sub: string };
type CalendarItem = LanedBar | TimedItem;

type Drag = {
  item: CalendarItem;
  pointerId: number;
  startX: number;
  startY: number;
  grabDay: number;
  /** How far below the item's start the pointer took hold, so the item doesn't jump to the pointer. */
  grabMinutes: number;
  active: boolean;
  dayIdx: number;
  minutes: number;
};
type Preview = { key: string; dayIdx: number; minutes: number; grabDay: number };

type Change =
  | { type: "project"; id: string; deltaDays: number }
  | { type: "milestone"; id: string; date: string }
  | { type: "meeting"; id: string; originalDate: string; date: string };

type Data = { events: CalendarProject[]; meetings: CalendarMeeting[] };
type MoveResult = { ok: boolean };
type PendingMeetingChoice = { source: Extract<Source, { type: "meeting" }>; newDate: string; name: string; when: string };

// The grid covers the full day so nothing is hidden; it just opens scrolled
// to the working hours. The box caps to the viewport height but never shows
// fewer than MIN_VISIBLE_HOURS rows.
const DEFAULT_VIEW_START_HOUR = 6;
const DEFAULT_VIEW_END_HOUR = 20;
const HOUR_PX = 72;
const MIN_VISIBLE_HOURS = 8;
const GRID_HEIGHT = 24 * HOUR_PX;
const VISIBLE_VIEWPORT_HEIGHT = (DEFAULT_VIEW_END_HOUR - DEFAULT_VIEW_START_HOUR) * HOUR_PX;
const TIME_COLUMN_PX = 44;
const SNAP_MINUTES = 15;
const DRAG_THRESHOLD_PX = 5;
const AUTOSCROLL_EDGE_PX = 36;
const AUTOSCROLL_STEP_PX = 8;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GRID_COLUMNS = "grid grid-cols-[44px_repeat(7,minmax(0,1fr))]";

const isTimed = (item: CalendarItem): item is TimedItem => "startMin" in item;
const noon = (key: string) => new Date(`${key}T12:00:00Z`);
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const shiftIso = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString();

function applyChange(data: Data, change: Change): Data {
  if (change.type === "meeting") {
    return {
      ...data,
      meetings: data.meetings.map((m) => (m.id === change.id && m.originalDate === change.originalDate ? { ...m, date: change.date } : m)),
    };
  }
  if (change.type === "milestone") {
    return {
      ...data,
      events: data.events.map((e) => ({ ...e, milestones: e.milestones.map((m) => (m.id === change.id ? { ...m, date: change.date } : m)) })),
    };
  }
  return {
    ...data,
    events: data.events.map((e) =>
      e.id === change.id
        ? {
            ...e,
            buildDate: e.buildDate && shiftIso(e.buildDate, change.deltaDays),
            startDate: shiftIso(e.startDate, change.deltaDays),
            endDate: shiftIso(e.endDate, change.deltaDays),
            strikeDate: e.strikeDate && shiftIso(e.strikeDate, change.deltaDays),
          }
        : e
    ),
  };
}

// The current time only exists in the browser, so the server renders no time line.
function subscribeToClock(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}
const readClock = () => Math.floor(new Date().getTime() / 30_000) * 30_000;
const readServerClock = () => null;

/**
 * Week grid, Monday to Sunday in Prague time whatever the server's or
 * browser's timezone. Dragging uses pointer events so mouse and finger behave
 * the same. A move shows at once through useOptimistic and is saved by the
 * existing reschedule actions; if the save fails the item falls back to its
 * saved position and a message says so.
 */
export function WeekCalendar({
  weekKey,
  today,
  events,
  meetings,
  locale,
}: {
  weekKey: string;
  today: string;
  events: CalendarProject[];
  meetings: CalendarMeeting[];
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.calendar;
  const router = useRouter();
  const dayKeys = Array.from({ length: 7 }, (_, i) => shiftDateKey(weekKey, i));
  const todayIdx = dayKeys.indexOf(today);

  const [data, addChange] = useOptimistic<Data, Change>({ events, meetings }, applyChange);
  const [, startTransition] = useTransition();
  const [pendingChoice, setPendingChoice] = useState<PendingMeetingChoice | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [hover, setHover] = useState<CalendarItem | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const dragRef = useRef<Drag | null>(null);
  const justDraggedRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  const verticalScrollRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const hoverCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    verticalScrollRef.current?.scrollTo?.({ top: DEFAULT_VIEW_START_HOUR * HOUR_PX });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const nowMs = useSyncExternalStore(subscribeToClock, readClock, readServerClock);
  const nowMinutes = nowMs === null ? null : pragueMinutes(new Date(nowMs));

  const placeHoverCard = useCallback(() => {
    const card = hoverCardRef.current;
    if (!card) return;
    const { x, y } = pointerRef.current;
    const margin = 8;
    const gap = 14;
    const fitsRight = x + gap + card.offsetWidth + margin <= window.innerWidth;
    const left = fitsRight ? x + gap : x - gap - card.offsetWidth;
    const top = Math.min(y + gap, window.innerHeight - card.offsetHeight - margin);
    card.style.left = `${Math.max(margin, left)}px`;
    card.style.top = `${Math.max(margin, top)}px`;
  }, []);
  useLayoutEffect(placeHoverCard, [hover, placeHoverCard]);

  const dayFromX = useCallback((x: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const columnWidth = (rect.width - TIME_COLUMN_PX) / 7;
    return Math.min(6, Math.max(0, Math.floor((x - rect.left - TIME_COLUMN_PX) / columnWidth)));
  }, []);
  const minutesFromY = useCallback((y: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    return rect ? ((y - rect.top) / HOUR_PX) * 60 : 0;
  }, []);

  const trackPointer = useCallback(() => {
    const drag = dragRef.current;
    if (!drag?.active) return;
    const { x, y } = pointerRef.current;
    drag.dayIdx = dayFromX(x);
    if (isTimed(drag.item)) {
      const snapped = Math.round((minutesFromY(y) - drag.grabMinutes) / SNAP_MINUTES) * SNAP_MINUTES;
      drag.minutes = Math.min(24 * 60 - SNAP_MINUTES, Math.max(0, snapped));
    }
    const next = { key: drag.item.key, dayIdx: drag.dayIdx, minutes: drag.minutes, grabDay: drag.grabDay };
    setPreview((cur) => (cur && cur.dayIdx === next.dayIdx && cur.minutes === next.minutes && cur.key === next.key ? cur : next));
  }, [dayFromX, minutesFromY]);

  // Holding near an edge keeps scrolling, so the item can reach hours or days that are off screen.
  const draggingKey = preview?.key ?? null;
  useEffect(() => {
    if (!draggingKey) return;
    let frame = requestAnimationFrame(function scroll() {
      const { x, y } = pointerRef.current;
      const vertical = verticalScrollRef.current;
      const horizontal = horizontalScrollRef.current;
      if (vertical && dragRef.current && isTimed(dragRef.current.item)) {
        const r = vertical.getBoundingClientRect();
        if (y < r.top + AUTOSCROLL_EDGE_PX) vertical.scrollTop -= AUTOSCROLL_STEP_PX;
        else if (y > r.bottom - AUTOSCROLL_EDGE_PX) vertical.scrollTop += AUTOSCROLL_STEP_PX;
      }
      if (horizontal) {
        const r = horizontal.getBoundingClientRect();
        if (x < r.left + AUTOSCROLL_EDGE_PX) horizontal.scrollLeft -= AUTOSCROLL_STEP_PX;
        else if (x > r.right - AUTOSCROLL_EDGE_PX) horizontal.scrollLeft += AUTOSCROLL_STEP_PX;
      }
      trackPointer();
      frame = requestAnimationFrame(scroll);
    });
    return () => cancelAnimationFrame(frame);
  }, [draggingKey, trackPointer]);

  function save(change: Change, name: string, when: string, action: (formData: FormData) => Promise<MoveResult>, formData: FormData) {
    startTransition(async () => {
      addChange(change);
      let ok = false;
      try {
        ok = (await action(formData)).ok;
      } catch {
        // A lost connection or a server error is reported the same way as a refused move.
      }
      setToast({ ok, text: ok ? t.moved(name, when) : t.moveFailed(name) });
    });
  }

  function moveToDate(item: CalendarItem, newDate: string, when: string) {
    const { source } = item;
    const formData = new FormData();
    if (source.type === "milestone") {
      formData.set("itemId", source.id);
      formData.set("date", newDate);
      save({ type: "milestone", id: source.id, date: newDate }, item.label, when, rescheduleRoadmapItemAction, formData);
    } else if (source.type === "meeting") {
      if (source.recurring) {
        setPendingChoice({ source, newDate, name: item.label, when });
        return;
      }
      formData.set("id", source.id);
      formData.set("date", newDate);
      save({ type: "meeting", id: source.id, originalDate: source.originalDate, date: newDate }, item.label, when, rescheduleMeetingAction, formData);
    }
  }

  function commitDrag(drag: Drag) {
    const { item, dayIdx, minutes, grabDay } = drag;
    if (isTimed(item)) {
      if (dayIdx === item.dayIdx && minutes === item.startMin) return;
      const newDate = pragueInstant(dayKeys[dayIdx], minutes).toISOString();
      moveToDate(item, newDate, `${formatPragueDate(newDate, locale, { weekday: "short", day: "numeric", month: "short" })} ${clock(minutes)}`);
      return;
    }
    const deltaDays = dayIdx - grabDay;
    if (deltaDays === 0) return;
    const { source } = item;
    if (source.type === "project") {
      const formData = new FormData();
      formData.set("id", source.id);
      formData.set("deltaDays", String(deltaDays));
      const when = formatPragueRange(shiftIso(source.startDate, deltaDays), shiftIso(source.endDate, deltaDays), locale);
      save({ type: "project", id: source.id, deltaDays }, item.label, when, rescheduleProjectAction, formData);
      return;
    }
    const newDate = pragueInstant(shiftDateKey(pragueDateKey(source.date), deltaDays), pragueMinutes(source.date)).toISOString();
    moveToDate(item, newDate, formatPragueDate(newDate, locale, { weekday: "short", day: "numeric", month: "short" }));
  }

  function resolvePendingChoice(scope: "occurrence" | "future") {
    if (!pendingChoice) return;
    const { source, newDate, name, when } = pendingChoice;
    const formData = new FormData();
    formData.set("meetingId", source.id);
    formData.set("originalDate", source.originalDate);
    formData.set("newDate", newDate);
    const action = scope === "occurrence" ? rescheduleMeetingOccurrenceAction : splitMeetingSeriesAction;
    save({ type: "meeting", id: source.id, originalDate: source.originalDate, date: newDate }, name, when, action, formData);
    setPendingChoice(null);
  }

  function endDrag() {
    dragRef.current = null;
    setPreview(null);
  }

  function eventProps(item: CalendarItem) {
    return {
      href: item.href,
      draggable: false,
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
      onClick: (e: React.MouseEvent) => {
        // The click that ends a drag must not open the project.
        if (justDraggedRef.current) e.preventDefault();
        justDraggedRef.current = false;
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        // Enter already follows the link; Space doesn't.
        if (e.key === " ") {
          e.preventDefault();
          router.push(item.href);
        }
      },
      onPointerEnter: (e: ReactPointerEvent) => {
        if (e.pointerType !== "mouse" || dragRef.current?.active) return;
        pointerRef.current = { x: e.clientX, y: e.clientY };
        setHover(item);
      },
      onPointerLeave: () => setHover(null),
      onPointerDown: (e: ReactPointerEvent<HTMLAnchorElement>) => {
        justDraggedRef.current = false;
        if (e.button !== 0 || !item.editable) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pointerRef.current = { x: e.clientX, y: e.clientY };
        const grabDay = dayFromX(e.clientX);
        dragRef.current = {
          item,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          grabDay,
          grabMinutes: isTimed(item) ? minutesFromY(e.clientY) - item.startMin : 0,
          active: false,
          dayIdx: isTimed(item) ? item.dayIdx : grabDay,
          minutes: isTimed(item) ? item.startMin : 0,
        };
      },
      onPointerMove: (e: ReactPointerEvent) => {
        pointerRef.current = { x: e.clientX, y: e.clientY };
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) {
          if (e.pointerType === "mouse") placeHoverCard();
          return;
        }
        if (!drag.active) {
          if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) {
            if (e.pointerType === "mouse") placeHoverCard();
            return;
          }
          drag.active = true;
          setHover(null);
        }
        trackPointer();
      },
      onPointerUp: (e: ReactPointerEvent) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        if (drag.active) {
          pointerRef.current = { x: e.clientX, y: e.clientY };
          trackPointer();
          justDraggedRef.current = true;
          commitDrag(drag);
        }
        endDrag();
      },
      onPointerCancel: endDrag,
    };
  }

  const bars: BarItem[] = [];
  const timed: TimedItem[] = [];
  const clampRange = (startKey: string, endKey: string) => {
    const colStart = Math.max(0, daysBetweenKeys(weekKey, startKey));
    const colEnd = Math.min(6, daysBetweenKeys(weekKey, endKey));
    return colStart <= colEnd ? { colStart, colEnd } : null;
  };
  const weekdayDate = (iso: string) => formatPragueDate(iso, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const keyRange = (from: string, to: string) => formatPragueRange(noon(from), noon(to), locale);

  for (const project of data.events) {
    const label = `${project.number} · ${project.title}`;
    const href = projectHref(project);
    const source: Source = { type: "project", id: project.id, startDate: project.startDate, endDate: project.endDate };
    const shared = { client: project.client, status: project.status, value: project.value, where: project.place, title: project.title };
    const startKey = pragueDateKey(project.startDate);
    const endKey = pragueDateKey(project.endDate);
    const addBar = (kind: "prep" | "main" | "strike", fromKey: string, toKey: string, sub: string) => {
      const range = clampRange(fromKey, toKey);
      if (!range) return;
      bars.push({
        ...range,
        key: `project-${project.id}-${kind}`,
        href,
        label,
        source,
        editable: project.editable,
        tone: kind === "main" ? "main" : "prep",
        address: project.address,
        details: { ...shared, head: `${project.number} · ${sub}`, when: keyRange(fromKey, toKey) },
      });
    };

    const buildKey = project.buildDate ? pragueDateKey(project.buildDate) : startKey;
    if (buildKey < startKey) addBar("prep", buildKey, shiftDateKey(startKey, -1), t.subPrepBuild);
    addBar("main", startKey, endKey, t.subProjectDays);
    const strikeKey = project.strikeDate ? pragueDateKey(project.strikeDate) : endKey;
    if (strikeKey > endKey) addBar("strike", shiftDateKey(endKey, 1), strikeKey, t.subStrike);

    for (const m of project.milestones) {
      const base = {
        key: `milestone-${m.id}`,
        href,
        label,
        source: { type: "milestone", id: m.id, date: m.date } as Source,
        editable: project.editable,
      };
      const dayIdx = daysBetweenKeys(weekKey, pragueDateKey(m.date));
      if (dayIdx < 0 || dayIdx > 6) continue;
      if (m.allDay) {
        bars.push({ ...base, tone: "milestone", colStart: dayIdx, colEnd: dayIdx, details: { ...shared, head: `${project.number} · ${m.title}`, when: weekdayDate(m.date) } });
      } else {
        const startMin = pragueMinutes(m.date);
        const time = clock(startMin);
        timed.push({
          ...base,
          tone: "milestone",
          dayIdx,
          startMin,
          endMin: Math.min(24 * 60, startMin + 60),
          time,
          sub: m.title,
          details: { ...shared, head: `${project.number} · ${m.title}`, when: `${weekdayDate(m.date)} · ${time}` },
        });
      }
    }
  }

  for (const m of data.meetings) {
    const linked = m.projects[0];
    const dayIdx = daysBetweenKeys(weekKey, pragueDateKey(m.date));
    if (dayIdx < 0 || dayIdx > 6) continue;
    const base = {
      key: `meeting-${m.id}-${m.originalDate}`,
      href: linked ? projectHref(linked) : `/meetings/${m.id}/edit`,
      label: linked ? `${linked.number} · ${linked.title}` : m.title,
      source: { type: "meeting", id: m.id, date: m.date, originalDate: m.originalDate, recurring: m.recurring, title: m.title } as Source,
      editable: m.editable,
    };
    const head = linked ? `${linked.number} · ${t.legendMeeting}` : t.legendMeeting;
    const title = m.title;
    if (m.allDay) {
      bars.push({ ...base, tone: "meeting", colStart: dayIdx, colEnd: dayIdx, details: { head, title, when: weekdayDate(m.date) } });
    } else {
      const startMin = pragueMinutes(m.date);
      const time = clock(startMin);
      timed.push({
        ...base,
        tone: "meeting",
        dayIdx,
        startMin,
        endMin: Math.min(24 * 60, startMin + 60),
        time,
        sub: linked ? m.title : t.legendMeeting,
        details: { head, title, when: `${weekdayDate(m.date)} · ${time}` },
      });
    }
  }

  const lanedBars = assignLanes(bars);
  const barPreview = preview ? lanedBars.find((b) => b.key === preview.key) : undefined;
  const timedPreview = preview ? timed.find((i) => i.key === preview.key) : undefined;
  const dragClasses = (item: CalendarItem) =>
    `select-none [-webkit-touch-callout:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
      item.editable ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-pointer"
    } ${preview?.key === item.key ? "opacity-30" : "opacity-100"}`;

  return (
    <div>
      <section aria-label={dict.projects.viewCalendar} className="card p-3 md:p-4 min-w-0">
        {/* Seven readable columns need more room than a phone has, so this box scrolls sideways, not the page. */}
        <div ref={horizontalScrollRef} className="overflow-x-auto overscroll-x-contain">
          <div className="min-w-[820px]">
            <div className={`${GRID_COLUMNS} border-b border-ink/20 pb-1.5`}>
              <div className="heading-label !text-[11px] !tracking-normal whitespace-nowrap self-center">W{isoWeekNumber(parseIsoDate(weekKey))}</div>
              {dayKeys.map((key, i) => (
                <div key={key} className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-ink/70">
                  <span className="uppercase tracking-[0.06em]">{formatPragueDate(noon(key), locale, { weekday: "short" })}</span>
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${i === todayIdx ? "bg-accent text-white" : ""}`}>
                    {Number(key.slice(8))}
                  </span>
                </div>
              ))}
            </div>

            <div className={`${GRID_COLUMNS} auto-rows-[36px] gap-y-0.5 py-1.5 border-b border-ink/30`}>
              <div className="label font-semibold self-center" style={{ gridRow: 1, gridColumn: 1 }}>
                {t.allDay}
              </div>
              {lanedBars.map((bar) => (
                <Link
                  key={bar.key}
                  {...eventProps(bar)}
                  aria-label={`${bar.label}, ${bar.details.when}`}
                  className={`overflow-hidden rounded-md px-1.5 mx-px flex flex-col justify-center gap-0.5 shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition-opacity motion-reduce:transition-none ${dragClasses(bar)} ${
                    bar.tone === "main"
                      ? "bg-accent text-ink"
                      : bar.tone === "meeting"
                        ? "bg-accent/10 border-2 border-dashed border-accent/60"
                        : bar.tone === "milestone"
                          ? "bg-ink/22 border-2 border-ink/45"
                          : "bg-ink/14"
                  }`}
                  style={{ gridRow: bar.lane + 1, gridColumn: `${bar.colStart + 2} / ${bar.colEnd + 3}` }}
                >
                  <span className="text-[10.5px] font-bold truncate leading-tight">{bar.label}</span>
                  {bar.address && (
                    <span className="flex items-center gap-1 text-[9px] font-semibold truncate leading-tight opacity-75">
                      <WaypointIcon className="shrink-0" />
                      <span className="truncate">{bar.address}</span>
                    </span>
                  )}
                </Link>
              ))}
              {barPreview && preview && (
                <div
                  aria-hidden
                  className="pointer-events-none rounded-md mx-px border-2 border-dashed border-accent bg-accent/40 shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
                  style={{
                    gridRow: barPreview.lane + 1,
                    gridColumn: `${Math.min(6, Math.max(0, barPreview.colStart + preview.dayIdx - preview.grabDay)) + 2} / ${
                      Math.min(6, Math.max(0, barPreview.colEnd + preview.dayIdx - preview.grabDay)) + 3
                    }`,
                  }}
                />
              )}
            </div>

            <div
              ref={verticalScrollRef}
              className="overflow-y-auto mt-1"
              style={{ maxHeight: `clamp(${MIN_VISIBLE_HOURS * HOUR_PX}px, calc(100dvh - 15rem), ${VISIBLE_VIEWPORT_HEIGHT}px)` }}
            >
              <div ref={gridRef} className={`relative ${GRID_COLUMNS}`}>
                <div>
                  {HOURS.map((h) => (
                    <div key={h} className="label font-semibold" style={{ height: HOUR_PX }}>
                      {clock(h * 60)}
                    </div>
                  ))}
                </div>
                {dayKeys.map((key, dayIdx) => (
                  <div
                    key={key}
                    className={`relative border-l border-ink/13 ${preview?.dayIdx === dayIdx ? "bg-accent/10" : ""}`}
                    style={{
                      height: GRID_HEIGHT,
                      backgroundImage: `repeating-linear-gradient(to bottom, rgba(243,242,242,.1) 0 1px, transparent 1px ${HOUR_PX}px)`,
                    }}
                  >
                    {assignColumns(timed.filter((item) => item.dayIdx === dayIdx)).map((item) => (
                      <Link
                        key={item.key}
                        {...eventProps(item)}
                        aria-label={`${item.label}, ${item.details.when}, ${item.sub}`}
                        className={`absolute overflow-hidden rounded-md leading-tight px-1 py-0.5 box-border shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition-opacity motion-reduce:transition-none ${dragClasses(item)} ${
                          item.tone === "meeting"
                            ? "bg-surface border-2 border-dashed border-accent/60 hover:border-accent"
                            : "bg-surface border-2 border-ink/45 hover:border-accent"
                        }`}
                        style={{
                          top: (item.startMin / 60) * HOUR_PX,
                          height: Math.max(16, ((item.endMin - item.startMin) / 60) * HOUR_PX),
                          ...overlapBoxStyle(item.col),
                        }}
                      >
                        <div className={`text-[10.5px] font-bold truncate ${item.tone === "meeting" ? "text-accent" : ""}`}>{item.label}</div>
                        <div className="text-[9.5px] font-semibold text-ink/70 tabular-nums">{item.time}</div>
                        <div className="placeholder-text text-[9.5px] font-semibold truncate">{item.sub}</div>
                      </Link>
                    ))}
                    {timedPreview && preview?.dayIdx === dayIdx && (
                      <div
                        aria-hidden
                        className="absolute left-0 w-full overflow-hidden rounded-md leading-tight border-2 border-dashed border-accent bg-accent/25 px-1 py-0.5 box-border pointer-events-none shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
                        style={{ top: (preview.minutes / 60) * HOUR_PX, height: HOUR_PX, zIndex: 20 }}
                      >
                        <div className="text-[10.5px] font-bold text-accent truncate">{clock(preview.minutes)}</div>
                      </div>
                    )}
                  </div>
                ))}

                {todayIdx >= 0 && nowMinutes !== null && (
                  <>
                    <div className="absolute pointer-events-none bg-warning/70 z-10" style={{ top: (nowMinutes / 60) * HOUR_PX, left: TIME_COLUMN_PX, right: 0, height: 1 }} />
                    <div
                      className="absolute pointer-events-none bg-warning z-10 rounded-full"
                      style={{
                        top: (nowMinutes / 60) * HOUR_PX - 1,
                        left: `calc(44px + (100% - 44px) * ${todayIdx} / 7)`,
                        width: `calc((100% - 44px) / 7)`,
                        height: 3,
                      }}
                    />
                    <div
                      className="absolute pointer-events-none bg-warning text-ink text-[10px] font-bold rounded px-1.5 py-[1px] z-20 -translate-y-1/2"
                      style={{ top: (nowMinutes / 60) * HOUR_PX, left: 2 }}
                    >
                      {clock(nowMinutes)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3.5 flex-wrap mt-2.5">
          <Legend swatch="bg-accent" label={t.legendProjectDays} />
          <Legend swatch="bg-ink/14" label={t.legendPrepBuild} />
          <Legend swatch="border-2 border-ink/45 bg-ink/22" label={t.legendMilestone} />
          <Legend swatch="border-2 border-dashed border-accent/60 bg-accent/10" label={t.legendMeeting} />
        </div>
        {lanedBars.length === 0 && timed.length === 0 && <p className="text-[13px] placeholder-text mt-3">{t.noProjectsThisWeek}</p>}
      </section>

      {/* Outside the card: its backdrop blur would make it the box these fixed layers are positioned in. */}
      {hover && (
        <div
          ref={hoverCardRef}
          data-testid="calendar-hover-card"
          className="fixed z-50 pointer-events-none glass-panel rounded-xl shadow-[0_18px_44px_rgba(0,0,0,0.55)] w-[280px] max-w-[calc(100vw-16px)] p-3.5 text-[12px]"
          style={{ left: 0, top: 0 }}
        >
          <div className="text-[10px] font-semibold tracking-[0.06em] placeholder-text">{hover.details.head}</div>
          <div className="text-[14px] font-semibold leading-snug mt-0.5 break-words">{hover.details.title}</div>
          <dl className="mt-2 flex flex-col gap-1">
            <HoverRow label={t.hoverWhen}>{hover.details.when}</HoverRow>
            {hover.details.where && <HoverRow label={t.hoverWhere}>{hover.details.where}</HoverRow>}
            {hover.details.client && <HoverRow label={t.hoverClient}>{hover.details.client}</HoverRow>}
            {hover.details.status && (
              <HoverRow label={t.hoverStatus}>
                <ProjectStatusChip status={hover.details.status} t={dict.statusProject} />
              </HoverRow>
            )}
            {hover.details.value !== undefined && hover.details.value !== null && <HoverRow label={t.hoverValue}>{formatCurrency(hover.details.value)}</HoverRow>}
          </dl>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed z-50 left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 w-max max-w-[calc(100vw-32px)] glass-panel rounded-xl shadow-[0_18px_44px_rgba(0,0,0,0.55)] px-4 py-2.5 text-[13px] border ${
            toast.ok ? "border-ink/15" : "border-warning/60 text-warning"
          }`}
        >
          {toast.text}
        </div>
      )}

      {pendingChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm p-4" role="presentation" onClick={() => setPendingChoice(null)}>
          <div className="glass-panel rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55)] w-full max-w-sm p-6" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-bold mb-2">{dict.meetings.reschedule.title}</div>
            <p className="text-[14px] leading-relaxed text-ink/85">{dict.meetings.reschedule.question(pendingChoice.source.title)}</p>
            <div className="flex flex-col gap-2 mt-6">
              <button type="button" className="btn" autoFocus onClick={() => resolvePendingChoice("occurrence")}>
                {dict.meetings.reschedule.thisOccurrence}
              </button>
              <button type="button" className="btno" onClick={() => resolvePendingChoice("future")}>
                {dict.meetings.reschedule.thisAndFuture}
              </button>
              <button type="button" className="btno !border-transparent" onClick={() => setPendingChoice(null)}>
                {dict.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HoverRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-[92px] shrink-0 placeholder-text text-[11px]">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
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

function WaypointIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
