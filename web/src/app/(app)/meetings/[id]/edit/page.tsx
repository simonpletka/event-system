import { notFound } from "next/navigation";
import { requireUser, canManageMeetings } from "@/lib/authz";
import { getMeetingDetail, getEventOptionsForUser } from "@/lib/queries/meetings";
import { deleteMeetingAction } from "@/lib/actions/meetings";
import { MeetingForm } from "@/components/meetings/MeetingForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const meeting = await getMeetingDetail(user, id);
  if (!meeting) notFound();
  const locale = await getLocale();
  const t = getDictionary(locale);
  const canManage = canManageMeetings(user);

  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between border-b border-ink/14 pb-4 mb-5">
        <h1 className="text-[28px] font-bold tracking-tight">{t.meetings.editMeetingH1(meeting.title)}</h1>
        {canManage && (
          <ConfirmDeleteButton
            action={deleteMeetingAction}
            fields={{ id: meeting.id }}
            confirmMessage={t.meetings.confirmDelete(meeting.title)}
            label={t.meetings.delete}
          />
        )}
      </div>
      {!canManage ? (
        <p className="text-lg font-semibold text-ink">{t.meetings.noPermEdit}</p>
      ) : (
        <MeetingForm
          defaults={{
            id: meeting.id,
            title: meeting.title,
            type: meeting.type,
            date: meeting.date,
            allDay: meeting.allDay,
            attendees: meeting.attendees,
            note: meeting.note,
            recurrenceFreq: meeting.recurrenceFreq,
            recurrenceInterval: meeting.recurrenceInterval,
            recurrenceUntil: meeting.recurrenceUntil,
            eventIds: meeting.events.map((e) => e.eventId),
          }}
          eventOptions={await getEventOptionsForUser(user)}
          locale={locale}
        />
      )}
    </div>
  );
}
