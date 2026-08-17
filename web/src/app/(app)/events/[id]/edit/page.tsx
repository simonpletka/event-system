import { notFound } from "next/navigation";
import { requireUser, canEditEvent } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { getClientOptions } from "@/lib/queries/clients";
import { EventForm } from "@/components/EventForm";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();

  const editable = canEditEvent(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });
  const clients = editable ? await getClientOptions() : [];

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Edit event</h1>
      {!editable ? (
        <p className="text-sm placeholder-text">You don&apos;t have permission to edit this event.</p>
      ) : (
        <EventForm
          clients={clients}
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
