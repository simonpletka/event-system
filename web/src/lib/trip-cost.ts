/**
 * Own-car vs carsharing comparison for one trip. Pure, so the page and any
 * future caller price a trip identically.
 */
import type { RentalSegment } from "@/lib/trip-schedule";

export type PlanBands = {
  /** "hour" bills each started hour in full (AutoGo's Vito). */
  unit: "min" | "hour";
  /** Sorted by `from` (minutes into the rental). `time` is Kč per `unit`, `km` Kč per km. */
  rows: { from: number; time: number; km: number }[];
};

export type PlanInput = {
  id: string;
  provider: string;
  name: string;
  carClass: string;
  packagePrice: number;
  packageMinutes: number | null;
  packageKm: number;
  minuteRate: number;
  kmRate: number;
  bandsJson: string | null;
  weekendOnly: boolean;
  verified: boolean;
};

export type TripOption = {
  key: string;
  provider: string;
  carClass: string;
  /** The tariff picked for each rental, in trip order. */
  planNames: string[];
  verified: boolean;
  total: number;
  /** What the same operator and car class would cost as one unbroken rental. */
  unsplitTotal: number;
};
export type HiddenPlan = PlanInput & { total: number | null; reason: "weekend" | "dearer"; cheaperName: string | null };

/**
 * Mirrors AutoGo's public calculator: each band's time rate applies to the
 * minutes inside that band, and km are spread evenly over the rental's
 * duration so each band's km rate applies to its share of the distance.
 */
function bandCost(bands: PlanBands, minutes: number, km: number) {
  const billed = bands.unit === "hour" ? Math.ceil(minutes / 60) * 60 : minutes;
  const kmPerMinute = minutes > 0 ? km / minutes : 0;
  let total = 0;
  bands.rows.forEach((row, i) => {
    const next = bands.rows[i + 1]?.from ?? Infinity;
    if (billed > row.from) {
      const perMinute = bands.unit === "hour" ? row.time / 60 : row.time;
      total += (Math.min(billed, next) - row.from) * perMinute;
    }
    if (minutes > row.from) total += (Math.min(minutes, next) - row.from) * kmPerMinute * row.km;
  });
  return total;
}

export function planCost(plan: PlanInput, minutes: number, km: number) {
  if (plan.bandsJson) return bandCost(JSON.parse(plan.bandsJson) as PlanBands, minutes, km);
  const extraMinutes = plan.packageMinutes == null ? minutes : Math.max(0, minutes - plan.packageMinutes);
  // A package's price is only the entry fee — time past it falls back to the
  // minute rate, as both Anytime and Car4way describe, and km past the
  // allowance are charged on top.
  return plan.packagePrice + extraMinutes * plan.minuteRate + Math.max(0, km - plan.packageKm) * plan.kmRate;
}

/**
 * Picks the cheapest tariff for each rental within every operator and car
 * class, then hides the tariffs no rental uses: a package is only worth
 * showing if nothing else from that operator covers the rental for less in
 * the same size of car. Each split rental is priced on its own, since
 * operators bill a new rental from zero.
 */
export function compareCarsharing(plans: PlanInput[], segments: RentalSegment[], wholeTrip: RentalSegment, isWeekend: boolean) {
  const hidden: HiddenPlan[] = [];
  const groups = new Map<string, PlanInput[]>();
  for (const plan of plans) {
    if (plan.weekendOnly && !isWeekend) {
      hidden.push({ ...plan, total: null, reason: "weekend", cheaperName: null });
      continue;
    }
    const key = `${plan.provider}|${plan.carClass}`;
    groups.set(key, [...(groups.get(key) ?? []), plan]);
  }

  const cheapestFor = (group: PlanInput[], s: RentalSegment) =>
    group
      .map((plan) => ({ plan, total: planCost(plan, s.minutes, s.km) }))
      .reduce((best, next) => (next.total < best.total ? next : best));

  const visible = [...groups.entries()].map(([key, group]) => {
    const picks = segments.map((s) => cheapestFor(group, s));
    const used = new Set(picks.map((p) => p.plan.id));
    for (const plan of group) {
      if (used.has(plan.id)) continue;
      const total = segments.reduce((sum, s) => sum + planCost(plan, s.minutes, s.km), 0);
      hidden.push({ ...plan, total, reason: "dearer", cheaperName: picks[0].plan.name });
    }
    return {
      key,
      provider: group[0].provider,
      carClass: group[0].carClass,
      planNames: picks.map((p) => p.plan.name),
      verified: picks.every((p) => p.plan.verified),
      total: picks.reduce((sum, p) => sum + p.total, 0),
      unsplitTotal: cheapestFor(group, wholeTrip).total,
    } satisfies TripOption;
  });

  return {
    visible: visible.sort((a, b) => a.total - b.total),
    hidden: hidden.sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity)),
  };
}

export type VehicleInput = {
  id: string;
  name: string;
  consumptionPer100Km: number;
  fuelPricePerLitre: number;
  extraCostPerKm: number;
};

export function vehicleCost(vehicle: VehicleInput, km: number) {
  const litres = (km / 100) * vehicle.consumptionPer100Km;
  return { litres, fuel: litres * vehicle.fuelPricePerLitre, total: litres * vehicle.fuelPricePerLitre + km * vehicle.extraCostPerKm };
}
