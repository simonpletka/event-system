import Link from "next/link";
import { deleteTripAction } from "@/lib/actions/trips";
import { GOOGLE_MAPS_MAX_STOPS, googleMapsNavigateUrl, googleMapsTripUrl, googleMapsUrl, wazeUrl } from "@/lib/routing";
import { buildSchedule, driveWithBuffer, formatClock, rentalSegments } from "@/lib/trip-schedule";
import { compareCarsharing, vehicleCost, type PlanInput, type VehicleInput } from "@/lib/trip-cost";
import { parseIsoDate } from "@/lib/calendar";
import { formatCurrency, formatDate, formatDurationShort } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { NavigateIcon } from "@/components/ui/icons";
import { TripMap } from "@/components/trips/TripMap";
import { getDictionary, type Locale } from "@/lib/dictionary";

type Stop = {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  arriveMin: number | null;
  departMin: number | null;
  stayMinutes: number | null;
  manualMinutes: number | null;
  legMinutes: number | null;
  legKm: number | null;
  legSource: string | null;
  legPolyline: string | null;
  splitRental: boolean;
  note: string;
};

function point(s: Stop) {
  return s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null;
}

export function TripCard({
  trip,
  plans,
  vehicles,
  usingDefaultVehicle,
  editHref,
  locale,
}: {
  trip: { id: string; title: string; date: string; bufferMinutes: number; stops: Stop[] };
  plans: PlanInput[];
  vehicles: VehicleInput[];
  usingDefaultVehicle: boolean;
  editHref: string | null;
  locale: Locale;
}) {
  const t = getDictionary(locale).projects.trips;
  const { stops } = trip;
  const drive = stops.map((s, i) => (i === 0 ? null : driveWithBuffer(s, trip.bufferMinutes)));
  const schedule = buildSchedule(
    stops.map((s, i) => ({
      arriveMin: s.arriveMin,
      departMin: s.departMin,
      stayMinutes: s.stayMinutes,
      driveMinutes: drive[i],
    }))
  );

  const km = stops.reduce((sum, s) => sum + (s.legKm ?? 0), 0);
  const driving = drive.reduce<number>((sum, d) => sum + (d ?? 0), 0);
  const rental = schedule.start != null && schedule.end != null ? schedule.end - schedule.start : driving;
  const day = parseIsoDate(trip.date);
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  const segments = rentalSegments(stops, schedule, drive);
  const { visible, hidden } = compareCarsharing(plans, segments, { minutes: rental, km }, isWeekend);
  const isSplit = segments.length > 1;
  const parked = Math.max(0, rental - driving);
  const missingLeg = stops.some((s, i) => i > 0 && s.legKm == null);
  const located = stops.flatMap((s) => (point(s) ? [point(s)!] : []));
  // A stop Photon couldn't locate still navigates fine by its address text.
  const places = stops.map((s) => point(s) ?? s.address);
  const stopName = (s: Stop) => s.label || s.address;
  const beyondLink = stops[GOOGLE_MAPS_MAX_STOPS + 1];
  const source = (s: Stop) =>
    s.manualMinutes != null ? t.sourceManual : s.legSource === "google" ? t.sourceGoogle : s.legSource === "osm" ? t.sourceOsm : t.sourceNone;

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{trip.title}</h2>
          <p className="text-[12px] placeholder-text mt-0.5">
            {formatDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {schedule.start != null && schedule.end != null && ` · ${formatClock(schedule.start)} – ${formatClock(schedule.end)}`}
            {` · ${km.toFixed(1)} km · ${t.driving(formatDurationShort(driving))}`}
          </p>
        </div>
        {editHref && (
          <div className="flex gap-1.5">
            <Link href={editHref} className="btno">
              {t.edit}
            </Link>
            <ConfirmDeleteButton
              action={deleteTripAction}
              fields={{ tripId: trip.id }}
              confirmMessage={t.confirmDelete(trip.title)}
              label={t.delete}
            />
          </div>
        )}
      </div>

      {schedule.start == null && <p className="text-[12px] text-warning mt-3">{t.noPinnedTime}</p>}
      {schedule.incomplete && <p className="text-[12px] text-warning mt-3">{t.incomplete}</p>}

      {stops.length >= 2 && (
        <div className="md:hidden mt-4">
          <a
            href={googleMapsNavigateUrl(places.slice(1))}
            target="_blank"
            rel="noopener noreferrer"
            className="btn !text-[12px] !py-3.5 w-full flex items-center justify-center gap-2"
          >
            <NavigateIcon size={16} />
            {t.startJourney}
          </a>
          <p className="text-[11px] placeholder-text mt-2">{t.startJourneyHint(stops.length - 1, stopName(stops[0]))}</p>
          {beyondLink && <p className="text-[11px] text-warning mt-1">{t.journeyLimit(stopName(beyondLink))}</p>}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-4 items-start">
      <ol>
        {stops.map((stop, i) => {
          const at = schedule.stops[i];
          const isFirst = i === 0;
          const from = i > 0 ? point(stops[i - 1]) : null;
          const to = point(stop);
          const stayed = at.arrive != null && at.depart != null ? at.depart - at.arrive : 0;
          const navigateLabel = i < stops.length - 1 ? t.navigateFrom(stopName(stop)) : t.navigateTo(stopName(stop));
          return (
            <li key={stop.id}>
              {i > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[72px] py-2 text-[11px] placeholder-text">
                  <span>
                    {drive[i] != null ? formatDurationShort(drive[i]!) : "—"}
                    {stop.legKm != null && ` · ${stop.legKm.toFixed(1)} km`}
                    {` · ${source(stop)}`}
                  </span>
                  {from && to && (
                    <>
                      <a href={googleMapsUrl(from, to)} target="_blank" rel="noopener noreferrer" className="hidden md:inline underline hover:text-accent">
                        Google Maps
                      </a>
                      <a href={wazeUrl(to)} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent py-2 -my-2 md:py-0 md:my-0">
                        Waze
                      </a>
                    </>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <div className="w-[60px] shrink-0 text-right tabular-nums">
                  {!isFirst && at.arrive != null && <div className="font-semibold">{formatClock(at.arrive)}</div>}
                  {at.depart != null && (isFirst || stayed > 0) && (
                    <div className={isFirst ? "font-semibold" : "text-[11px] placeholder-text"}>{formatClock(at.depart)}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    <span className="placeholder-text">{i + 1}.</span> {stop.label || stop.address}
                  </div>
                  {stop.label && <div className="text-[11px] placeholder-text">{stop.address}</div>}
                  {!isFirst && stayed > 0 && <div className="text-[11px] placeholder-text">{t.stayFor(formatDurationShort(stayed))}</div>}
                  {stop.note && <div className="text-[11px] placeholder-text">{stop.note}</div>}
                  {stop.splitRental && i > 0 && i < stops.length - 1 && (
                    <div className="text-[11px] placeholder-text">{t.rentalSplitHere}</div>
                  )}
                  {!to && <div className="text-[11px] text-warning">{t.notLocated}</div>}
                  {at.waitMinutes > 0 && <div className="text-[11px] placeholder-text">{t.spare(formatDurationShort(at.waitMinutes))}</div>}
                  {at.lateMinutes > 0 && <div className="text-[11px] text-warning">{t.late(formatDurationShort(at.lateMinutes))}</div>}
                </div>
                <a
                  href={googleMapsNavigateUrl(places.slice(i))}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={navigateLabel}
                  title={navigateLabel}
                  className="md:hidden shrink-0 size-11 flex items-center justify-center rounded-full border border-ink/25 text-ink"
                >
                  <NavigateIcon size={17} />
                </a>
              </div>
            </li>
          );
        })}
      </ol>
      {located.length >= 2 && (
        <div>
          <TripMap
            stops={stops.map((s) => ({ lat: s.lat, lng: s.lng, polyline: s.legPolyline }))}
            label={t.mapLabel}
          />
          <a
            href={googleMapsTripUrl(located)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] placeholder-text underline hover:text-accent mt-1.5 hidden md:inline-block"
          >
            {t.openWholeRoute}
          </a>
        </div>
      )}
      </div>

      <div className="rule-thin my-4" />
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="heading-label !text-[12px]">{t.costHeading}</h3>
        <span className="text-[11px] placeholder-text">
          {isSplit
            ? t.costBasisSplit(km.toFixed(1), segments.map((s) => formatDurationShort(s.minutes)).join(" + "))
            : t.costBasis(km.toFixed(1), formatDurationShort(rental), formatDurationShort(parked))}
        </span>
      </div>
      {missingLeg && <p className="text-[12px] text-warning mt-2">{t.costMissingLeg}</p>}

      <table className="w-full mt-2 text-[13px]">
        <tbody>
          {vehicles.map((v) => {
            const cost = vehicleCost(v, km);
            return (
              <tr key={v.id} className="border-b border-ink/13">
                <td className="py-1.5">
                  {v.name}
                  <div className="text-[11px] placeholder-text">{t.ownCarDetail(v.consumptionPer100Km, cost.litres.toFixed(1), v.fuelPricePerLitre)}</div>
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums whitespace-nowrap">{formatCurrency(Math.round(cost.total))}</td>
              </tr>
            );
          })}
          {visible.map((plan) => (
            <tr key={plan.key} className="border-b border-ink/13">
              <td className="py-1.5">
                {plan.provider} · {[...new Set(plan.planNames)].join(" + ")}
                <div className="text-[11px] placeholder-text">
                  {plan.carClass}
                  {!plan.verified && ` · ${t.unverified}`}
                  {isSplit && ` · ${t.withoutSplit(formatCurrency(Math.round(plan.unsplitTotal)))}`}
                </div>
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums whitespace-nowrap">
                {!plan.verified && `${t.from} `}
                {formatCurrency(Math.round(plan.total))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {usingDefaultVehicle && <p className="text-[11px] placeholder-text mt-2">{t.defaultVehicleNote}</p>}
      <p className="text-[11px] placeholder-text mt-2 max-w-prose">{t.costNote}</p>

      {hidden.length > 0 && (
        <details className="mt-2 text-[12px]">
          <summary className="placeholder-text">{t.hiddenPlans(hidden.length)}</summary>
          <ul className="mt-1.5 space-y-1">
            {hidden.map((plan) => (
              <li key={plan.id} className="flex justify-between gap-3">
                <span>
                  {plan.provider} · {plan.name}
                  <span className="placeholder-text">
                    {" — "}
                    {plan.reason === "weekend" ? t.hiddenWeekend : t.hiddenDearer(plan.cheaperName ?? "")}
                  </span>
                </span>
                {plan.total != null && <span className="tabular-nums whitespace-nowrap">{formatCurrency(Math.round(plan.total))}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
