import Link from "next/link";
import { requireUser, canViewMeetings, canManageMeetings } from "@/lib/authz";
import { getMeetingList } from "@/lib/queries/meetings";
import { MeetingsView } from "@/components/meetings/MeetingsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { projectHref } from "@/lib/slug";
import { pragueDateKey } from "@/lib/prague-date";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const tm = getDictionary(locale).meetings;

  if (!canViewMeetings(user)) {
    return (
      <div className="max-w-3xl">
        <p className="text-lg font-semibold text-ink">{tm.noAccess}</p>
      </div>
    );
  }

  const params = await searchParams;
  const meetings = await getMeetingList(user);
  const canManage = canManageMeetings(user);
  const now = new Date();
  const today = pragueDateKey(now);
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  return (
    <div className="meetings-scope">
      <PageHeader>
        <div className="max-w-[1080px] flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-[48px] font-bold tracking-tight">{tm.title}</h1>
          {canManage && (
            <Link href="/meetings/new" className="btn font-semibold">
              {tm.newMeeting}
            </Link>
          )}
        </div>
      </PageHeader>
      <div className="max-w-[1080px] mt-5">
        <MeetingsView
          meetings={meetings.map((row) => ({
            id: row.id,
            title: row.title,
            type: row.type,
            date: row.shownDate.toISOString(),
            allDay: row.allDay,
            past: row.nextOccurrence === null,
            attendees: row.attendees,
            note: row.note,
            recurrenceFreq: row.recurrenceFreq,
            recurrenceInterval: row.recurrenceInterval,
            recurrenceUntil: row.recurrenceUntil?.toISOString() ?? null,
            projects: row.projects.map((p) => ({ id: p.id, title: p.title, href: projectHref(p) })),
          }))}
          today={today}
          tomorrow={tomorrow}
          initialFilter={params.type === "CLIENT" || params.type === "INTERNAL" ? params.type : "ALL"}
          canManage={canManage}
          locale={locale}
        />
      </div>
    </div>
  );
}
