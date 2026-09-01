import Link from "next/link";
import { requireUser, canViewMeetings, canManageMeetings } from "@/lib/authz";
import { getMeetingList } from "@/lib/queries/meetings";
import { formatDate, formatDateTime } from "@/lib/format";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { MeetingType } from "@/generated/prisma/enums";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);
  const tm = t.meetings;

  if (!canViewMeetings(user)) {
    return (
      <div className="max-w-3xl">
        <p className="text-lg font-semibold text-ink">{tm.noAccess}</p>
      </div>
    );
  }

  const params = await searchParams;
  const type = params.type === "CLIENT" || params.type === "INTERNAL" ? (params.type as MeetingType) : undefined;
  const meetings = await getMeetingList(user, type);
  const canManage = canManageMeetings(user);

  const typeFilters: { href: string; label: string; active: boolean }[] = [
    { href: "/meetings", label: tm.filterAll, active: !type },
    { href: "/meetings?type=CLIENT", label: tm.typeClient, active: type === "CLIENT" },
    { href: "/meetings?type=INTERNAL", label: tm.typeInternal, active: type === "INTERNAL" },
  ];

  return (
    <div>
      <PageHeader>
        <div className="flex items-end justify-between">
          <div>
            <div className="heading-label">{tm.countHeading(meetings.length)}</div>
            <h1 className="text-[28px] font-bold tracking-tight mt-1">{tm.title}</h1>
          </div>
          {canManage && (
            <Link href="/meetings/new" className="btn font-semibold">
              {tm.newMeeting}
            </Link>
          )}
        </div>

        <div className="flex gap-1.5 mt-4">
          {typeFilters.map((f) => (
            <Link key={f.href} href={f.href} className={f.active ? "btn text-[9px]" : "btno text-[9px]"}>
              {f.label}
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className="hidden md:block">
        <div className="grid grid-cols-[1.5fr_.7fr_1fr_1.2fr_1.2fr] gap-2.5 border-b border-ink/14 pb-1.5 mt-5 px-3.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
          <span className="heading-label">{tm.colName}</span>
          <span className="heading-label">{tm.colType}</span>
          <span className="heading-label">{tm.colDate}</span>
          <span className="heading-label">{tm.colAttendees}</span>
          <span className="heading-label">{tm.colEvents}</span>
        </div>

        {meetings.map((m) => (
          <Link
            key={m.id}
            href={`/meetings/${m.id}/edit`}
            className="group grid grid-cols-[1.5fr_.7fr_1fr_1.2fr_1.2fr] gap-2.5 items-center py-3.5 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[15px] hover:bg-ink/5"
          >
            <div className="font-medium group-hover:text-accent flex items-center gap-1.5">
              {m.title}
              {m.recurring && <span className="label !text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-ink/20">{tm.recurringBadge}</span>}
            </div>
            <div className="placeholder-text group-hover:!text-accent">{m.type === "CLIENT" ? tm.typeClient : tm.typeInternal}</div>
            <div className="placeholder-text group-hover:!text-accent">{m.allDay ? formatDate(m.date) : formatDateTime(m.date)}</div>
            <div className="placeholder-text group-hover:!text-accent truncate">{m.attendees || "—"}</div>
            <div className="placeholder-text group-hover:!text-accent truncate">{m.events.map((e) => e.title).join(", ") || "—"}</div>
          </Link>
        ))}
      </div>

      <div className="md:hidden flex flex-col gap-2 mt-4">
        {meetings.map((m) => (
          <MobileListRow
            key={m.id}
            href={`/meetings/${m.id}/edit`}
            title={m.title}
            meta={`${m.type === "CLIENT" ? tm.typeClient : tm.typeInternal} · ${m.allDay ? formatDate(m.date) : formatDateTime(m.date)}`}
            trailing={m.recurring ? tm.recurringBadge : undefined}
          />
        ))}
      </div>

      {meetings.length === 0 && (
        <EmptyState message={tm.noMeetingsYet} actionLabel={canManage ? tm.newMeeting : undefined} actionHref="/meetings/new" />
      )}
    </div>
  );
}
