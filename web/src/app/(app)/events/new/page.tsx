import { requireUser, canCreateEvent } from "@/lib/authz";
import { EventForm } from "@/components/EventForm";

export default async function NewEventPage() {
  const user = await requireUser();
  const now = new Date();

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">New event</h1>
      {!canCreateEvent(user) ? (
        <p className="text-sm placeholder-text">You don&apos;t have permission to create events.</p>
      ) : (
        <EventForm
          defaults={{
            title: "",
            brief: "",
            clientName: "",
            clientPhone: "",
            clientEmail: "",
            companyName: "",
            companyAddress: "",
            companyIco: "",
            companyDic: "",
            status: "INQUIRY",
            buildDate: null,
            startDate: now,
            endDate: now,
            strikeDate: null,
            quotedValue: 0,
            venues: [],
          }}
        />
      )}
    </div>
  );
}
