import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canEditEvent, isAdmin, canViewEventBudget } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatDateRange } from "@/lib/format";
import { EventStatusPill } from "@/components/StatusPill";
import { EventTabs } from "@/components/EventTabs";
import { BackLink } from "@/components/BackLink";
import { DeleteEventButton } from "@/components/DeleteEventButton";
import { deleteEventAction } from "@/lib/actions/events";
import { PageHeader } from "@/components/ui/PageHeader";
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

  const editable = canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });

  return (
    <div>
      <PageHeader pb="pb-2">
        <div className="max-w-6xl">
        <BackLink href="/events">{t.events.backToEvents}</BackLink>
        <div className="flex justify-between items-end flex-wrap gap-2 mt-2">
          <div>
            <div className="text-[24px] font-bold tracking-tight">
              <span className="placeholder-text font-medium">{event.number}</span> {event.title}
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] mt-1.5">
              <span className="placeholder-text">
                {event.clientId ? (
                  <Link href={`/clients/${event.clientId}`} className="hover:text-accent">
                    {event.companyName}
                  </Link>
                ) : (
                  event.companyName
                )}{" "}
                · {formatDateRange(event.startDate, event.endDate)}
                {event.venues[0] ? ` · ${event.venues[0].name}` : ""}
              </span>
              <EventStatusPill status={event.status} t={t.statusEvent} />
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
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

        <EventTabs eventId={event.id} showFinance={canViewEventBudget(user)} locale={locale} />
        </div>
      </PageHeader>

      <div className="mt-7 max-w-6xl">{children}</div>
    </div>
  );
}
