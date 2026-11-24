import { requireUser, canManageGear, projectWhereForUser } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { gearToday, getGearBatches, getGearTypeOptions, getReservableProjects } from "@/lib/queries/gear";
import { reservationScopeWhere, type ReservationScope } from "@/lib/gear-scope";
import { ChipLinks } from "@/components/ui/ChipLinks";
import { EmptyState } from "@/components/ui/EmptyState";
import { GearBatchCard } from "@/components/gear/GearBatchCard";
import { ReserveButton } from "@/components/gear/ReserveButton";

/** Every booking from today on, including those made for no project, with Release. */
export default async function GearReservationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale).gear;
  const { show: raw } = await searchParams;
  const show: ReservationScope = raw === "project" || raw === "none" ? raw : "all";
  const today = gearToday();
  const canManage = canManageGear(user);

  const where = reservationScopeWhere(projectWhereForUser(user), show, today);
  const [batches, types, projects] = await Promise.all([
    getGearBatches(where),
    canManage ? getGearTypeOptions() : Promise.resolve([]),
    canManage ? getReservableProjects(user) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <ChipLinks
        label={t.tabReservations}
        active={show}
        chips={[
          { key: "all", label: t.filterAll, href: "/gear/reservations" },
          { key: "project", label: t.filterWithProject, href: "/gear/reservations?show=project" },
          { key: "none", label: t.filterNoProject, href: "/gear/reservations?show=none" },
        ]}
      />
      {batches.length === 0 && <EmptyState message={show === "all" ? t.reservationsEmpty : t.reservationsNoneMatch} />}
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {batches.map((b) => (
          <GearBatchCard key={b.batchId} batch={b} showProject canRelease={canManage} edit={canManage ? { types, projects, today } : undefined} locale={locale} />
        ))}
      </div>
      {canManage && <ReserveButton label="" hideButton queryKey="reserve" locale={locale} projects={projects} types={types} initialLines={[]} today={today} />}
    </div>
  );
}
