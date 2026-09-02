import { notFound } from "next/navigation";
import { requireUser, canEditProject, isAdmin } from "@/lib/authz";
import { getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { parseProjectSlug } from "@/lib/slug";
import { getClientOptions } from "@/lib/queries/clients";
import { getOverviewUsers } from "@/lib/queries/timetracker";
import { ProjectForm } from "@/components/ProjectForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const number = parseProjectSlug(slug);
  if (!number) notFound();
  const id = await resolveProjectIdByNumber(number);
  if (!id) notFound();
  const event = await getProjectDetail(user, id);
  if (!event) notFound();
  const locale = await getLocale();
  const t = getDictionary(locale);

  const editable = canEditProject(user, { ownerId: event.ownerId, memberIds: event.members.map((m) => m.userId) });
  const [clients, teamOptions] = editable
    ? await Promise.all([getClientOptions(), getOverviewUsers()])
    : [[], []];

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.projects.editProjectH1}</h1>
      {!editable ? (
        <p className="text-lg font-semibold text-ink">{t.projects.noPermEdit}</p>
      ) : (
        <ProjectForm
          clients={clients}
          teamOptions={teamOptions}
          locale={locale}
          canEditBudget={isAdmin(user)}
          defaults={{
            id: event.id,
            number: event.number,
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
            budgetType: event.budgetType,
            budgetValue: event.budgetValue,
            venues: event.venues.map((v) => ({ name: v.name, address: v.address, note: v.note })),
            memberIds: event.members.map((m) => m.userId),
          }}
        />
      )}
    </div>
  );
}
