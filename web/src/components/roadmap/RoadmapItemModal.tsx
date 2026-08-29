"use client";

import { useEffect, useState, useTransition } from "react";
import { useActionState } from "react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import { formatDateTime } from "@/lib/format";
import {
  addRoadmapItemAction,
  updateRoadmapItemAction,
  deleteRoadmapItemAction,
  addRoadmapCommentAction,
  type RoadmapFormState,
} from "@/lib/actions/roadmap";
import type { RoadmapItemData, RoadmapDict } from "./RoadmapList";

const EMPTY: RoadmapFormState = {};

function toLocalInput(iso: string, allDay: boolean) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return allDay ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RoadmapItemModal({
  eventId,
  item,
  editable,
  teamOptions,
  clientEmails,
  t,
  cancelLabel,
  onClose,
}: {
  eventId: string;
  item: RoadmapItemData | null;
  editable: boolean;
  teamOptions: { id: string; name: string }[];
  clientEmails: { name: string; email: string }[];
  t: RoadmapDict;
  cancelLabel: string;
  onClose: () => void;
}) {
  const isEdit = Boolean(item);
  const [state, formAction, pending] = useActionState(isEdit ? updateRoadmapItemAction : addRoadmapItemAction, EMPTY);
  const [commentState, commentAction, commentPending] = useActionState(addRoadmapCommentAction, EMPTY);
  const [deleting, startDelete] = useTransition();
  const { confirm } = useConfirmDialog();

  const [type, setType] = useState(item?.type ?? "TASK");
  const [allDay, setAllDay] = useState(item?.allDay ?? false);
  const [assignees, setAssignees] = useState<string[]>(item?.assignees.map((a) => a.id) ?? []);
  const [attendees, setAttendees] = useState<{ name: string; email: string }[]>(
    item?.externalAttendees.length ? item.externalAttendees : [],
  );
  const dateValue = item ? toLocalInput(item.date, item.allDay) : "";

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  const emailListId = "roadmap-client-emails";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4" onClick={onClose} role="presentation">
      <div
        className="glass-panel rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">{isEdit ? (editable ? t.editItem : item!.title) : t.newItem}</div>
          <button type="button" onClick={onClose} className="btno px-2 py-1 text-[10px]" aria-label={cancelLabel}>
            ✕
          </button>
        </div>

        {!editable && isEdit && (
          <div className="flex flex-col gap-2 text-[13px] mb-1">
            <div className="placeholder-text text-[11px]">
              {(item!.type === "TASK" ? t.typeTask : item!.type === "MEETING" ? t.typeMeeting : t.typeMilestone)} ·{" "}
              {new Date(item!.date).toLocaleString("en-GB", item!.allDay ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
            {item!.note && <p className="whitespace-pre-wrap">{item!.note}</p>}
            {item!.assignees.length > 0 && (
              <div className="placeholder-text text-[11px]">
                {t.assigneesLabel}: {item!.assignees.map((a) => a.name).join(", ")}
              </div>
            )}
          </div>
        )}

        <form action={formAction} className={`flex-col gap-3 ${editable ? "flex" : "hidden"}`}>
          <input type="hidden" name={isEdit ? "id" : "eventId"} value={isEdit ? item!.id : eventId} />
          {assignees.map((id) => (
            <input key={id} type="hidden" name="assignees" value={id} />
          ))}
          {attendees.map((a, i) => (
            <span key={i} className="hidden">
              <input type="hidden" name="attendeeName" value={a.name} />
              <input type="hidden" name="attendeeEmail" value={a.email} />
            </span>
          ))}
          <input type="hidden" name="allDay" value={allDay ? "on" : ""} />

          <div className="grid grid-cols-[120px_1fr] gap-2">
            <label className="flex flex-col gap-1">
              <span className="field-label">{t.typeLabel}</span>
              <select name="type" value={type} onChange={(e) => setType(e.target.value as RoadmapItemData["type"])} className="input">
                <option value="TASK">{t.typeTask}</option>
                <option value="MEETING">{t.typeMeeting}</option>
                <option value="MILESTONE">{t.typeMilestone}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="field-label">{t.titleLabel}</span>
              <input name="title" defaultValue={item?.title ?? ""} required className="input" />
            </label>
          </div>

          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1 flex-1">
              <span className="field-label">{t.dateLabel}</span>
              <input
                name="date"
                type={allDay ? "date" : "datetime-local"}
                defaultValue={dateValue}
                required
                className="input"
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] pb-2.5">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-accent" />
              {t.allDayLabel}
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="field-label">{t.noteLabel}</span>
            <textarea name="note" defaultValue={item?.note ?? ""} rows={2} className="input" />
          </label>

          <div className="flex flex-col gap-1">
            <span className="field-label">{t.assigneesLabel}</span>
            <div className="flex flex-wrap gap-2">
              {teamOptions.map((u) => {
                const on = assignees.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setAssignees((a) => (on ? a.filter((x) => x !== u.id) : [...a, u.id]))}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      on ? "border-accent/50 bg-accent/10 text-accent" : "border-ink/15 text-ink/65 hover:text-ink"
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
              {teamOptions.length === 0 && <span className="text-[11px] placeholder-text">{t.noneAssigned}</span>}
            </div>
          </div>

          {type === "MEETING" && (
            <div className="flex flex-col gap-1.5">
              <span className="field-label">{t.attendeesLabel}</span>
              <datalist id={emailListId}>
                {clientEmails.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.name}
                  </option>
                ))}
              </datalist>
              {attendees.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={a.name}
                    onChange={(e) => setAttendees((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                    placeholder={t.attendeeName}
                    className="input flex-1 !py-1.5 text-[12px]"
                  />
                  <input
                    value={a.email}
                    list={emailListId}
                    onChange={(e) => setAttendees((rows) => rows.map((r, j) => (j === i ? { ...r, email: e.target.value } : r)))}
                    placeholder={t.attendeeEmail}
                    className="input flex-1 !py-1.5 text-[12px]"
                  />
                  <button type="button" onClick={() => setAttendees((rows) => rows.filter((_, j) => j !== i))} className="btno px-2 text-[9px]">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setAttendees((rows) => [...rows, { name: "", email: "" }])} className="btno self-start text-[9px]">
                + {t.addAttendee}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] placeholder-text pt-1">
            <button type="button" disabled className="btno text-[9px] opacity-50 cursor-not-allowed" title={t.notConnected}>
              {t.addGoogleMeet}
            </button>
            <span>{t.notConnected}</span>
          </div>

          {state.error && <p className="text-sm text-warning">{state.error}</p>}

          <div className="flex justify-between items-center gap-2 pt-1">
            <button type="submit" disabled={pending} className="btn">
              {pending ? t.saving : t.save}
            </button>
            {isEdit && (
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (!(await confirm(t.confirmDelete(item!.title)))) return;
                  const fd = new FormData();
                  fd.set("id", item!.id);
                  startDelete(() => {
                    deleteRoadmapItemAction(fd);
                    onClose();
                  });
                }}
                className="text-[10px] tracking-[0.12em] uppercase text-warning hover:underline"
              >
                {t.deleteItem}
              </button>
            )}
          </div>
        </form>

        {isEdit && (
          <div className="mt-5 pt-4 border-t border-ink/12">
            <div className="heading-label !text-[10px] mb-2">{t.commentsHeading(item!.comments.length)}</div>
            <div className="flex flex-col gap-2.5 mb-3">
              {item!.comments.length === 0 && <p className="text-[12px] placeholder-text">{t.noComments}</p>}
              {item!.comments.map((c) => (
                <div key={c.id} className="text-[12px]">
                  <span className="font-semibold">{c.authorName}</span>{" "}
                  <span className="placeholder-text">{formatDateTime(new Date(c.createdAt))}</span>
                  <div className="text-ink/85 mt-0.5 whitespace-pre-wrap">{c.body}</div>
                </div>
              ))}
            </div>
            <form key={item!.comments.length} action={commentAction} className="flex gap-2">
              <input type="hidden" name="id" value={item!.id} />
              <textarea name="body" rows={1} placeholder={t.commentPlaceholder} className="input flex-1 !py-2 text-[12px]" />
              <button type="submit" disabled={commentPending} className="btn self-end">
                {commentPending ? t.posting : t.postComment}
              </button>
            </form>
            {commentState.error && <p className="text-[12px] text-warning mt-1">{commentState.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
