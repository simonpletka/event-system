import { requireUser, canManageGear } from "@/lib/authz";
import { getLocale } from "@/lib/i18n";
import { isDateKey } from "@/lib/gear-reservations";
import { shiftDateKey } from "@/lib/prague-date";
import { gearToday, getGearAvailability, getGearTypeOptions, getReservableProjects } from "@/lib/queries/gear";
import { AvailabilityGrid } from "@/components/gear/AvailabilityGrid";
import { ReserveButton } from "@/components/gear/ReserveButton";

export default async function GearAvailabilityPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const { from: fromParam } = await searchParams;
  const today = gearToday();
  const from = fromParam && isDateKey(fromParam) ? fromParam : today;
  const canManage = canManageGear(user);
  const [{ days, categories, rows }, types, projects] = await Promise.all([
    getGearAvailability(from),
    canManage ? getGearTypeOptions() : Promise.resolve([]),
    canManage ? getReservableProjects(user) : Promise.resolve([]),
  ]);
  const href = (key: string) => (key === today ? "/gear/availability" : `/gear/availability?from=${key}`);

  return (
    <>
      <AvailabilityGrid
        days={days}
        today={today}
        categories={categories}
        rows={rows}
        prevHref={href(shiftDateKey(from, -14))}
        nextHref={href(shiftDateKey(from, 14))}
        todayHref={from === today ? null : href(today)}
        locale={locale}
      />
      {canManage && (
        <ReserveButton label="" hideButton queryKey="reserve" locale={locale} projects={projects} types={types} initialLines={[]} today={today} />
      )}
    </>
  );
}
