import { requireUser, canCreateEvent, isAdmin } from "@/lib/authz";
import { getClientOptions } from "@/lib/queries/clients";
import { EventForm } from "@/components/EventForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewEventPage() {
  const user = await requireUser();
  // Seed the date pickers with a sane placeholder rather than "now to the
  // minute": next full hour for the start, +2h for the end (the form's own
  // default event length). The user still picks the real dates.
  const startDefault = new Date();
  startDefault.setMinutes(0, 0, 0);
  startDefault.setHours(startDefault.getHours() + 1);
  const endDefault = new Date(startDefault.getTime() + 2 * 60 * 60 * 1000);
  const clients = canCreateEvent(user) ? await getClientOptions() : [];
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.events.newEventH1}</h1>
      {!canCreateEvent(user) ? (
        <p className="text-lg font-semibold text-ink">{t.events.noPermCreate}</p>
      ) : (
        <EventForm
          clients={clients}
          locale={locale}
          canEditBudget={isAdmin(user)}
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
            startDate: startDefault,
            endDate: endDefault,
            strikeDate: null,
            quotedValue: 0,
            budgetType: "NONE",
            budgetValue: 0,
            venues: [],
          }}
        />
      )}
    </div>
  );
}
