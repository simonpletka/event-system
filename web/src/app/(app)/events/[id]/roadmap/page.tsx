import { notFound } from "next/navigation";
import { requireUser, canEditEvent } from "@/lib/authz";
import { getEventRoadmap } from "@/lib/queries/events";
import { getOverviewUsers } from "@/lib/queries/timetracker";
import { derivePhaseAnchors } from "@/lib/roadmap";
import { getLocale, getDictionary } from "@/lib/i18n";
import { RoadmapList, type RoadmapItemData } from "@/components/roadmap/RoadmapList";

export default async function RoadmapTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventRoadmap(user, id);
  if (!event) notFound();
  const locale = await getLocale();
  const tr = getDictionary(locale).events.roadmap;

  const editable = canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });
  const allUsers = editable ? await getOverviewUsers() : [];

  const items: RoadmapItemData[] = event.roadmapItems.map((it) => ({
    id: it.id,
    type: it.type,
    title: it.title,
    date: it.date.toISOString(),
    allDay: it.allDay,
    done: it.done,
    note: it.note,
    assignees: it.assignees.map((a) => ({ id: a.userId, name: a.user.name })),
    externalAttendees: it.externalAttendees.map((a) => ({ name: a.name, email: a.email })),
    comments: it.comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: c.author?.name ?? "—",
      createdAt: c.createdAt.toISOString(),
    })),
  }));

  const phases = derivePhaseAnchors(event, { build: tr.phaseBuild, event: tr.phaseEvent, strike: tr.phaseStrike }).map((p) => ({
    key: p.key,
    label: p.label,
    date: p.date.toISOString(),
    endDate: p.endDate?.toISOString(),
  }));

  return (
    <RoadmapList
      eventId={event.id}
      items={items}
      phases={phases}
      editable={editable}
      teamOptions={allUsers.map((u) => ({ id: u.id, name: u.name }))}
      clientEmails={event.contacts.filter((c) => c.email).map((c) => ({ name: c.name, email: c.email }))}
      locale={locale}
    />
  );
}
