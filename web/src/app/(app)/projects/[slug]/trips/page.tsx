import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canEditProject } from "@/lib/authz";
import { getProjectDetail, resolveProjectIdByNumber } from "@/lib/queries/projects";
import { getCarsharingPlans, getProjectTrips, getUserVehicles } from "@/lib/queries/trips";
import { parseProjectSlug, projectHref } from "@/lib/slug";
import { isoDate } from "@/lib/calendar";
import { isGoogleRoutingConfigured } from "@/lib/routing";
import { DEFAULT_VEHICLE } from "@/lib/carsharing-defaults";
import { getLocale, getDictionary } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { TripCard } from "@/components/trips/TripCard";
import { TripForm, type TripFormValues } from "@/components/trips/TripForm";

function minutesToClock(minutes: number | null) {
  if (minutes == null) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export default async function TripsTab({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const query = await searchParams;
  const number = parseProjectSlug(slug);
  if (!number) notFound();
  const id = await resolveProjectIdByNumber(number);
  if (!id) notFound();
  const project = await getProjectDetail(user, id);
  if (!project) notFound();

  const locale = await getLocale();
  const t = getDictionary(locale).projects.trips;
  const editable = canEditProject(user, { ownerId: project.ownerId, memberIds: project.members.map((m) => m.userId) });
  const [trips, plans, vehicles] = await Promise.all([getProjectTrips(id), getCarsharingPlans(), getUserVehicles(user.id)]);
  const base = projectHref(project, "/trips");

  const editing = editable && query.edit ? trips.find((x) => x.id === query.edit) : undefined;
  if (editable && (editing || query.new)) {
    const venue = project.venues[0];
    const blank = { label: "", address: "", lat: null, lng: null, arrive: "", depart: "", stay: "", manual: "", splitRental: false, note: "" };
    const values: TripFormValues = editing
      ? {
          id: editing.id,
          title: editing.title,
          date: editing.date,
          bufferMinutes: editing.bufferMinutes,
          stops: editing.stops.map((s) => ({
            label: s.label,
            address: s.address,
            lat: s.lat,
            lng: s.lng,
            arrive: minutesToClock(s.arriveMin),
            depart: minutesToClock(s.departMin),
            stay: s.stayMinutes?.toString() ?? "",
            manual: s.manualMinutes?.toString() ?? "",
            splitRental: s.splitRental,
            note: s.note,
          })),
        }
      : {
          id: "",
          title: "",
          date: isoDate(project.startDate),
          bufferMinutes: 5,
          stops: [blank, venue ? { ...blank, label: venue.name, address: venue.address } : blank],
        };
    return <TripForm projectId={id} values={values} cancelHref={base} locale={locale} />;
  }

  const activePlans = plans.filter((p) => p.active);
  const ownCars = vehicles.length > 0 ? vehicles : [DEFAULT_VEHICLE];

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        {isGoogleRoutingConfigured() ? (
          <p className="text-[12px] font-bold max-w-prose">{t.routingGoogle}</p>
        ) : (
          <p className="text-[12px] placeholder-text max-w-prose">{t.routingOsm}</p>
        )}
        {editable && (
          <Link href={`${base}?new=1`} className="btn shrink-0">
            {t.newTrip}
          </Link>
        )}
      </div>

      {trips.length === 0 && <EmptyState message={t.empty} />}
      <div className="space-y-4">
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            plans={activePlans}
            vehicles={ownCars}
            usingDefaultVehicle={vehicles.length === 0}
            editHref={editable ? `${base}?edit=${trip.id}` : null}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}
