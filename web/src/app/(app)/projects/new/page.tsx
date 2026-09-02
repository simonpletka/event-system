import { requireUser, canCreateProject, isAdmin } from "@/lib/authz";
import { getClientOptions } from "@/lib/queries/clients";
import { getOverviewUsers } from "@/lib/queries/timetracker";
import { ProjectForm } from "@/components/ProjectForm";
import { formatClientAddress } from "@/lib/format";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  // Seed the date pickers with a sane placeholder rather than "now to the
  // minute": next full hour for the start, +2h for the end (the form's own
  // default event length). The user still picks the real dates.
  const startDefault = new Date();
  startDefault.setMinutes(0, 0, 0);
  startDefault.setHours(startDefault.getHours() + 1);
  const endDefault = new Date(startDefault.getTime() + 2 * 60 * 60 * 1000);
  const allowed = canCreateProject(user);
  const [clients, teamOptions] = allowed
    ? await Promise.all([getClientOptions(), getOverviewUsers()])
    : [[], []];
  const locale = await getLocale();
  const t = getDictionary(locale);

  // Pre-link a client when arriving from a client's detail page ("New event").
  const preClient = params.clientId ? clients.find((c) => c.id === params.clientId) : undefined;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.projects.newProjectH1}</h1>
      {!allowed ? (
        <p className="text-lg font-semibold text-ink">{t.projects.noPermCreate}</p>
      ) : (
        <ProjectForm
          clients={clients}
          teamOptions={teamOptions}
          locale={locale}
          canEditBudget={isAdmin(user)}
          defaults={{
            title: "",
            brief: "",
            clientId: preClient?.id ?? null,
            contacts: [],
            companyName: preClient?.name ?? "",
            companyAddress: preClient
              ? formatClientAddress({
                  street: preClient.street ?? "",
                  city: preClient.city ?? "",
                  postCode: preClient.postCode ?? "",
                  state: preClient.state ?? "",
                })
              : "",
            companyIco: preClient?.ico ?? "",
            companyDic: preClient?.dic ?? "",
            status: "INQUIRY",
            buildDate: null,
            startDate: startDefault,
            endDate: endDefault,
            strikeDate: null,
            quotedValue: 0,
            budgetType: "NONE",
            budgetValue: 0,
            venues: [],
            memberIds: [user.id],
          }}
        />
      )}
    </div>
  );
}
