import { requireUser, canCreateEvent } from "@/lib/authz";
import { getClientOptions } from "@/lib/queries/clients";
import { EventForm } from "@/components/EventForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewEventPage() {
  const user = await requireUser();
  const now = new Date();
  const clients = canCreateEvent(user) ? await getClientOptions() : [];
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.events.newEventH1}</h1>
      {!canCreateEvent(user) ? (
        <p className="text-lg font-semibold text-ink">{t.events.noPermCreate}</p>
      ) : (
        <EventForm
          clients={clients}
          locale={locale}
          defaults={{
            title: "",
            brief: "",
            clientId: null,
            contacts: [],
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
