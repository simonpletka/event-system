import { notFound } from "next/navigation";
import { requireUser, canEditEvent } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatDateTime } from "@/lib/format";
import { addMilestoneAction, deleteMilestoneAction } from "@/lib/actions/events";

export default async function MilestonesTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();

  const editable = canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });

  return (
    <div className="max-w-xl">
      <p className="text-[10px] placeholder-text mb-3">
        Synced to Google Calendar in a later phase — for now milestones live only in this system.
      </p>

      {event.milestones.length === 0 && <p className="text-sm placeholder-text">No milestones yet.</p>}
      {event.milestones.map((m) => (
        <div key={m.id} className="grid grid-cols-[110px_1fr_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px]">
          <div className="placeholder-text">{formatDateTime(m.date)}</div>
          <div>{m.title}</div>
          {editable && (
            <form action={deleteMilestoneAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="milestoneId" value={m.id} />
              <button type="submit" className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-accent">
                Delete
              </button>
            </form>
          )}
        </div>
      ))}

      {editable && (
        <form action={addMilestoneAction} className="flex gap-2 items-end mt-4">
          <input type="hidden" name="eventId" value={event.id} />
          <label className="flex flex-col gap-1.5 flex-1">
            <span className="heading-label">Title</span>
            <input name="title" required className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">Date</span>
            <input name="date" type="datetime-local" required className="input" />
          </label>
          <button type="submit" className="btn">
            Add milestone
          </button>
        </form>
      )}
    </div>
  );
}
