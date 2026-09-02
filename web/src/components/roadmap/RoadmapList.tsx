"use client";

import { useMemo, useState, useTransition } from "react";
import type { RoadmapItemType } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { groupRoadmapItems, type RoadmapGroup } from "@/lib/roadmap";
import { toggleRoadmapItemDoneAction } from "@/lib/actions/roadmap";
import { RoadmapItemModal } from "./RoadmapItemModal";
import { getDictionary, type Locale } from "@/lib/dictionary";

export type RoadmapDict = ReturnType<typeof getDictionary>["projects"]["roadmap"];

export type RoadmapItemData = {
  id: string;
  type: RoadmapItemType;
  title: string;
  date: string;
  allDay: boolean;
  done: boolean;
  note: string;
  assignees: { id: string; name: string }[];
  externalAttendees: { name: string; email: string }[];
  comments: { id: string; body: string; authorName: string; createdAt: string }[];
};

type PhaseData = { key: string; label: string; date: string; endDate?: string };

const GROUP_ORDER: RoadmapGroup[] = ["overdue", "thisWeek", "later", "done"];

const TYPE_STYLE: Record<RoadmapItemType, string> = {
  TASK: "bg-ink/8 text-ink/70",
  MEETING: "bg-positive/15 text-positive",
  MILESTONE: "bg-accent/14 text-accent",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function dateLabel(iso: string, allDay: boolean) {
  const d = new Date(iso);
  const day = formatDate(d, { day: "numeric", month: "short" });
  if (allDay) return day;
  return `${day} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function RoadmapList({
  projectId,
  items,
  phases,
  editable,
  teamOptions,
  clientEmails,
  locale,
}: {
  projectId: string;
  items: RoadmapItemData[];
  phases: PhaseData[];
  editable: boolean;
  teamOptions: { id: string; name: string }[];
  clientEmails: { name: string; email: string }[];
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.projects.roadmap;
  const cancelLabel = dict.common.cancel;
  const [filter, setFilter] = useState<"all" | "tasks" | "meetings" | "done">("all");
  // `null` = closed, `""` = new item, otherwise an item id. Looked up against
  // the live `items` prop so a revalidation (new comment, edit) flows through.
  const [modalId, setModalId] = useState<string | null>(null);
  const modalItem = modalId ? items.find((i) => i.id === modalId) ?? null : null;
  const modalOpen = modalId !== null && (modalId === "" || modalItem !== null);
  const [, startToggle] = useTransition();

  const filtered = useMemo(() => {
    if (filter === "tasks") return items.filter((i) => i.type === "TASK" || i.type === "MILESTONE");
    if (filter === "meetings") return items.filter((i) => i.type === "MEETING");
    if (filter === "done") return items.filter((i) => i.done);
    return items;
  }, [items, filter]);

  const groups = useMemo(
    () => groupRoadmapItems(filtered.map((i) => ({ ...i, date: new Date(i.date) })), new Date()),
    [filtered],
  );

  function toggleDone(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startToggle(() => toggleRoadmapItemDoneAction(fd));
  }

  const filters: [typeof filter, string][] = [
    ["all", t.filterAll],
    ["tasks", t.filterTasks],
    ["meetings", t.filterMeetings],
    ["done", t.filterDone],
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5">
          {filters.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-[10px] font-semibold tracking-[0.05em] uppercase px-3 py-1.5 rounded-full border transition-colors ${
                filter === k ? "border-accent/45 bg-accent/8 text-accent" : "border-ink/12 text-ink/55 hover:text-ink/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {editable && (
          <button onClick={() => setModalId("")} className="btn font-semibold">
            + {t.addItem}
          </button>
        )}
      </div>

      <p className="text-[11px] placeholder-text mt-3 max-w-prose">{t.intro}</p>

      {items.length === 0 && phases.length === 0 && <p className="text-sm placeholder-text mt-6">{t.empty}</p>}

      {/* Production phases — read-only anchors */}
      {filter === "all" && phases.length > 0 && (
        <div className="mt-5">
          <div className="heading-label !text-[9px] mb-1.5">{t.typePhase}</div>
          {phases.map((p) => (
            <div key={p.key} className="flex items-center gap-3 py-2 border-t border-ink/8 first:border-t-0 text-[13px]">
              <span className="text-[8px] font-bold tracking-[0.08em] uppercase px-1.5 py-1 rounded bg-accent/14 text-accent shrink-0 w-[64px] text-center">
                {t.typePhase}
              </span>
              <span className="flex-1">{p.label}</span>
              <span className="placeholder-text text-[11px] tabular-nums">
                {p.endDate
                  ? `${formatDate(new Date(p.date))} – ${formatDate(new Date(p.endDate))}`
                  : dateLabel(p.date, true)}
              </span>
            </div>
          ))}
        </div>
      )}

      {GROUP_ORDER.map((g) => {
        const rows = groups[g];
        if (rows.length === 0) return null;
        return (
          <div key={g} className="mt-6">
            <div className={`heading-label !text-[9px] mb-1.5 ${g === "overdue" ? "!text-warning" : ""}`}>
              {g === "overdue" ? t.groupOverdue : g === "thisWeek" ? t.groupThisWeek : g === "later" ? t.groupLater : t.groupDone}
            </div>
            {rows.map((row) => {
              const it = items.find((x) => x.id === row.id)!;
              return (
                <div
                  key={it.id}
                  className={`group flex items-center gap-3 py-2.5 border-t border-ink/8 first:border-t-0 text-[13px] ${it.done ? "opacity-55" : ""}`}
                >
                  {editable && (
                    <button
                      onClick={() => toggleDone(it.id)}
                      aria-label="toggle done"
                      className={`w-4 h-4 rounded-[5px] border shrink-0 grid place-items-center ${
                        it.done ? "bg-accent border-accent text-[10px] text-ink" : "border-ink/40 hover:border-accent"
                      }`}
                    >
                      {it.done ? "✓" : ""}
                    </button>
                  )}
                  <span className={`text-[8px] font-bold tracking-[0.08em] uppercase px-1.5 py-1 rounded shrink-0 w-[64px] text-center ${TYPE_STYLE[it.type]}`}>
                    {it.type === "TASK" ? t.typeTask : it.type === "MEETING" ? t.typeMeeting : t.typeMilestone}
                  </span>
                  <button onClick={() => setModalId(it.id)} className={`flex-1 text-left hover:text-accent ${it.done ? "line-through" : ""}`}>
                    {it.title}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {it.comments.length > 0 && <span className="text-[10px] placeholder-text">💬 {it.comments.length}</span>}
                    <div className="flex -space-x-1">
                      {it.assignees.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          title={a.name}
                          className="w-5 h-5 rounded-md bg-accent/16 text-accent border border-accent/20 grid place-items-center text-[8px] font-bold"
                        >
                          {initials(a.name)}
                        </span>
                      ))}
                    </div>
                    <span className="placeholder-text text-[11px] tabular-nums w-[110px] text-right">{dateLabel(it.date, it.allDay)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {modalOpen && (
        <RoadmapItemModal
          key={modalId || "new"}
          projectId={projectId}
          item={modalItem}
          editable={editable}
          teamOptions={teamOptions}
          clientEmails={clientEmails}
          t={t}
          cancelLabel={cancelLabel}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}
