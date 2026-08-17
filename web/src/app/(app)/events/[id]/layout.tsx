import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canEditEvent, isAdmin } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatDateRange, formatMinutes } from "@/lib/format";
import { EventStatusPill } from "@/components/StatusPill";
import { EventTabs } from "@/components/EventTabs";
import { BackLink } from "@/components/BackLink";
import { DeleteEventButton } from "@/components/DeleteEventButton";
import { deleteEventAction } from "@/lib/actions/events";

export default async function EventDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();

  const totalMinutes = event.timeEntries.reduce((s, t) => s + t.minutes, 0);
  const editable = canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });

  return (
    <div>
      <BackLink href="/events">Events</BackLink>
      <div className="flex justify-between items-end border-b-2 border-ink pb-2 flex-wrap gap-2">
        <div>
          <div className="text-xl font-semibold">{event.title}</div>
          <div className="placeholder-text text-[11px] mt-0.5">
            {event.companyName} · {formatDateRange(event.startDate, event.endDate)}
            {event.venues[0] ? ` · ${event.venues[0].name}` : ""}
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <EventStatusPill status={event.status} />
          {editable && (
            <Link href={`/events/${event.id}/edit`} className="btno">
              Edit
            </Link>
          )}
          {isAdmin(user) && (
            <DeleteEventButton
              action={deleteEventAction}
              eventId={event.id}
              eventTitle={event.title}
              expenseCount={event.expenses.length}
            />
          )}
        </div>
      </div>

      <EventTabs
        eventId={event.id}
        counts={{ expenses: event.expenses.length, time: formatMinutes(totalMinutes), docs: event.quotes.length + event.invoices.length }}
      />

      <div className="mt-3.5">{children}</div>
    </div>
  );
}
