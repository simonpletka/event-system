import { requireUser, canManageGear } from "@/lib/authz";
import { getLocale } from "@/lib/i18n";
import { gearToday, getGearGroups, getGearTypeOptions, getReservableProjects } from "@/lib/queries/gear";
import { GroupsView } from "@/components/gear/GroupsView";

export default async function GearGroupsPage({ searchParams }: { searchParams: Promise<{ group?: string; new?: string; project?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const query = await searchParams;
  const canManage = canManageGear(user);
  const [groups, types, projects] = await Promise.all([getGearGroups(), getGearTypeOptions(), canManage ? getReservableProjects(user) : Promise.resolve([])]);
  const selectedId = groups.find((g) => g.id === query.group)?.id ?? groups[0]?.id ?? null;
  const initialProjectId = projects.some((p) => p.id === query.project) ? query.project : undefined;

  return (
    <GroupsView
      groups={groups}
      selectedId={selectedId}
      types={types}
      projects={projects}
      initialProjectId={initialProjectId}
      today={gearToday()}
      canManage={canManage}
      creating={query.new === "1"}
      locale={locale}
    />
  );
}
