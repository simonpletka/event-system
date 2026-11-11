import { requireUser, canManageMeetings } from "@/lib/authz";
import { getProjectOptionsForUser } from "@/lib/queries/meetings";
import { MeetingForm } from "@/components/meetings/MeetingForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);
  const params = await searchParams;

  return (
    <div className="meetings-scope max-w-3xl">
      <h1 className="text-[48px] leading-tight font-bold tracking-tight pb-4">{t.meetings.newMeetingH1}</h1>
      {!canManageMeetings(user) ? (
        <p className="text-lg font-semibold text-ink">{t.meetings.noPermAdd}</p>
      ) : (
        <MeetingForm
          defaults={{
            title: "",
            type: "CLIENT",
            date: new Date(),
            allDay: false,
            attendees: "",
            note: "",
            recurrenceFreq: "NONE",
            recurrenceInterval: 1,
            recurrenceUntil: null,
            projectIds: params.projectId ? [params.projectId] : [],
          }}
          eventOptions={await getProjectOptionsForUser(user)}
          locale={locale}
        />
      )}
    </div>
  );
}
