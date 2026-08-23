import { notFound } from "next/navigation";
import { requireUser, canEditEvent } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { getClientOptions } from "@/lib/queries/clients";
import { EventForm } from "@/components/EventForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();
  const locale = await getLocale();
  const t = getDictionary(locale);

  const editable = canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });
  const clients = editable ? await getClientOptions() : [];

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.events.editEventH1}</h1>
      {!editable ? (
        <p className="text-lg font-semibold text-ink">{t.events.noPermEdit}</p>
      ) : (
        <EventForm
          clients={clients}
          locale={locale}
          defaults={{
            id: event.id,
            title: event.title,
            brief: event.brief,
            clientId: event.clientId,
            contacts: event.contacts.map((c) => ({ name: c.name, phone: c.phone, email: c.email })),
            companyName: event.companyName,
            companyAddress: event.companyAddress,
            companyIco: event.companyIco,
            companyDic: event.companyDic,
            status: event.status,
            buildDate: event.buildDate,
            startDate: event.startDate,
            endDate: event.endDate,
            strikeDate: event.strikeDate,
            quotedValue: event.quotedValue,
            venues: event.venues.map((v) => ({ name: v.name, address: v.address, note: v.note })),
          }}
        />
      )}
    </div>
  );
}
