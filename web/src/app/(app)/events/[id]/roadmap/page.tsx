import { notFound } from "next/navigation";
import { requireUser, canEditEvent } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatDateTime } from "@/lib/format";
import { addMilestoneAction, deleteMilestoneAction } from "@/lib/actions/events";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { getLocale, getDictionary } from "@/lib/i18n";

// Interim: the migrated Milestones list. The full Roadmap (tasks, meetings,
// assignees, comments) lands in a later commit on this branch.
export default async function RoadmapTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();
  const t = getDictionary(await getLocale());
  const tm = t.events.milestones;
  const editable = canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });

  return (
    <div className="max-w-xl">
      {event.roadmapItems.length === 0 && <p className="text-sm placeholder-text">{tm.noMilestones}</p>}
      {event.roadmapItems.map((m) => (
        <div key={m.id} className="grid grid-cols-[130px_1fr_auto] gap-2.5 items-center py-2.5 border-b border-ink/10 text-[15px]">
          <div className="placeholder-text">{formatDateTime(m.date)}</div>
          <div>{m.title}</div>
          {editable && (
            <ConfirmDeleteButton
              action={deleteMilestoneAction}
              fields={{ eventId: event.id, milestoneId: m.id }}
              confirmMessage={tm.confirmDelete(m.title)}
              label={t.common.delete}
              className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-warning"
            />
          )}
        </div>
      ))}

      {editable && (
        <form action={addMilestoneAction} className="flex flex-col md:flex-row gap-2 md:items-end mt-4">
          <input type="hidden" name="eventId" value={event.id} />
          <label className="flex flex-col gap-1.5 flex-1">
            <span className="heading-label">{tm.titleLabel}</span>
            <input name="title" required className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">{tm.dateLabel}</span>
            <input name="date" type="datetime-local" required className="input" />
          </label>
          <button type="submit" className="btn">
            {tm.addMilestone}
          </button>
        </form>
      )}
    </div>
  );
}
