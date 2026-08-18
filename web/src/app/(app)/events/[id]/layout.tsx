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
import { getLocale, getDictionary } from "@/lib/i18n";

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
  const locale = await getLocale();
  const t = getDictionary(locale);

  const totalMinutes = event.timeEntries.reduce((s, t) => s + t.minutes, 0);
  const editable = canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 -mt-5 px-6 pt-5 pb-2 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <BackLink href="/events">{t.events.backToEvents}</BackLink>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[24px] font-bold tracking-tight">
              <span className="placeholder-text font-medium">{event.number}</span> {event.title}
            </div>
            <div className="placeholder-text text-[12px] mt-1">
              {event.companyName} · {formatDateRange(event.startDate, event.endDate)}
              {event.venues[0] ? ` · ${event.venues[0].name}` : ""}
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            <EventStatusPill status={event.status} t={t.statusEvent} />
            {editable && (
              <Link href={`/events/${event.id}/edit`} className="btno">
                {t.events.editEvent}
              </Link>
            )}
            {isAdmin(user) && (
              <DeleteEventButton
                action={deleteEventAction}
                eventId={event.id}
                eventTitle={event.title}
                expenseCount={event.expenses.length}
                invoiceCount={event.invoices.length}
                locale={locale}
              />
            )}
          </div>
        </div>

        <EventTabs
          eventId={event.id}
          counts={{ expenses: event.expenses.length, time: formatMinutes(totalMinutes), docs: event.quotes.length + event.invoices.length }}
          locale={locale}
        />
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}
