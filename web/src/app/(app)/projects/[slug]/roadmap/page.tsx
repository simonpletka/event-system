import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canEditProject, canViewMeetings, canManageMeetings } from "@/lib/authz";
import { getProjectRoadmap, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { parseProjectSlug } from "@/lib/slug";
import { getOverviewUsers } from "@/lib/queries/timetracker";
import { getMeetingsForProject } from "@/lib/queries/meetings";
import { derivePhaseAnchors } from "@/lib/roadmap";
import { formatDate, formatDateTime } from "@/lib/format";
import { getLocale, getDictionary } from "@/lib/i18n";
import { RoadmapList, type RoadmapItemData } from "@/components/roadmap/RoadmapList";

export default async function RoadmapTab({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const number = parseProjectSlug(slug);
  if (!number) notFound();
  const id = await resolveProjectIdByNumber(number);
  if (!id) notFound();
  const event = await getProjectRoadmap(user, id);
  if (!event) notFound();
  const locale = await getLocale();
  const tr = getDictionary(locale).projects.roadmap;

  const editable = canEditProject(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });
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

  const phases = derivePhaseAnchors(event, { build: tr.phaseBuild, event: tr.phaseProject, strike: tr.phaseStrike }).map((p) => ({
    key: p.key,
    label: p.label,
    date: p.date.toISOString(),
    endDate: p.endDate?.toISOString(),
  }));

  const tm = getDictionary(locale).meetings;
  const meetings = canViewMeetings(user) ? await getMeetingsForProject(user, event.id) : [];

  return (
    <>
      <RoadmapList
        projectId={event.id}
        items={items}
        phases={phases}
        editable={editable}
        teamOptions={allUsers.map((u) => ({ id: u.id, name: u.name }))}
        clientEmails={event.contacts.filter((c) => c.email).map((c) => ({ name: c.name, email: c.email }))}
        locale={locale}
      />

      {canViewMeetings(user) && (
        <div className="card p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="heading-label !text-[12px]">{tm.projectSection.heading(meetings.length)}</div>
            {canManageMeetings(user) && (
              <Link href={`/meetings/new?projectId=${event.id}`} className="btno text-[9px]">
                {tm.projectSection.newMeeting}
              </Link>
            )}
          </div>
          {meetings.length === 0 ? (
            <p className="text-[12px] placeholder-text">{tm.projectSection.empty}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {meetings.map((m) => (
                <Link key={m.id} href={`/meetings/${m.id}/edit`} className="flex items-center justify-between text-[13px] py-1.5 hover:text-accent">
                  <span>{m.title}</span>
                  <span className="placeholder-text text-[11px]">{m.allDay ? formatDate(m.date) : formatDateTime(m.date)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
