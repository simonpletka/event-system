/**
 * Own-car vs carsharing comparison for one trip. Pure, so the page and any
 * future caller price a trip identically.
 */
import type { RentalSegment } from "@/lib/trip-schedule";
import { bySize } from "@/lib/car-sizes";

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
  nightMinuteRate: number;
  kmRate: number;
  bandsJson: string | null;
  weekendOnly: boolean;
  verified: boolean;
};

export type TripOption = {
  provider: string;
  /** Every car type the operator has, smallest to biggest. */
  carClasses: string[];
  carClass: string;
  /** The tariff picked for each rental, in trip order. Empty when no tariff covers it. */
  planNames: string[];
  verified: boolean;
  /** Null when no tariff of this car can cover the trip. */
  total: number | null;
  /** What the same car would cost as one unbroken rental. */
  unsplitTotal: number | null;
  /** Each rental with the tariff picked for it, for the price breakdown. Empty when no tariff covers the trip. */
  rentals: { plan: PlanInput; segment: RentalSegment }[];
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
  let time = 0;
  let distance = 0;
  bands.rows.forEach((row, i) => {
    const next = bands.rows[i + 1]?.from ?? Infinity;
    if (billed > row.from) {
      const perMinute = bands.unit === "hour" ? row.time / 60 : row.time;
      time += (Math.min(billed, next) - row.from) * perMinute;
    }
    if (minutes > row.from) distance += (Math.min(minutes, next) - row.from) * kmPerMinute * row.km;
  });
  return { time, distance };
}

const DAY_STARTS = 6 * 60;
const NIGHT_STARTS = 20 * 60;

/** Minutes of [start, start + length) that fall between 6:00 and 20:00, over any number of days. */
export function daytimeMinutes(start: number, length: number) {
  const end = start + length;
  let total = 0;
  for (let day = Math.floor(start / 1440); day * 1440 < end; day++) {
    const from = Math.max(start, day * 1440 + DAY_STARTS);
    const to = Math.min(end, day * 1440 + NIGHT_STARTS);
    if (to > from) total += to - from;
  }
  return total;
}

/**
 * A package's price is only the entry fee: time past it falls back to the
 * minute rate, as both Anytime and Car4way describe, and km past the
 * allowance are charged on top. A tariff with no minute rate can't run past
 * its time, so that costs Infinity. With a night rate and a known start, each
 * minute is billed at the rate of the time it falls in; without a start, all
 * at the day rate.
 */
export function planCost(plan: PlanInput, minutes: number, km: number, start: number | null = null) {
  return planBreakdown(plan, minutes, km, start).total;
}

export type PlanBreakdown =
  | { kind: "bands"; time: number; km: number; kmCost: number; total: number }
  | {
      kind: "package";
      packagePrice: number;
      extraMinutes: number;
      /** Extra minutes at the day rate and, with a night rate, at the night rate. */
      dayMinutes: number;
      nightMinutes: number;
      minuteRate: number;
      nightMinuteRate: number;
      timeCost: number;
      extraKm: number;
      kmRate: number;
      kmCost: number;
      total: number;
    };

/** planCost, itemised: what the package, the extra time and the extra km each add. */
export function planBreakdown(plan: PlanInput, minutes: number, km: number, start: number | null = null): PlanBreakdown {
  if (plan.bandsJson) {
    const { time, distance } = bandCost(JSON.parse(plan.bandsJson) as PlanBands, minutes, km);
    return { kind: "bands", time, km, kmCost: distance, total: time + distance };
  }
  const included = plan.packageMinutes ?? 0;
  const extraMinutes = Math.max(0, minutes - included);
  const split = plan.nightMinuteRate > 0 && start != null;
  const dayMinutes = split ? daytimeMinutes(start + included, extraMinutes) : extraMinutes;
  const nightMinutes = extraMinutes - dayMinutes;
  const timeCost =
    extraMinutes > 0 && plan.minuteRate <= 0 ? Infinity : dayMinutes * plan.minuteRate + nightMinutes * plan.nightMinuteRate;
  const extraKm = Math.max(0, km - plan.packageKm);
  const kmCost = extraKm * plan.kmRate;
  return {
    kind: "package",
    packagePrice: plan.packagePrice,
    extraMinutes,
    dayMinutes,
    nightMinutes,
    minuteRate: plan.minuteRate,
    nightMinuteRate: plan.nightMinuteRate,
    timeCost,
    extraKm,
    kmRate: plan.kmRate,
    kmCost,
    total: plan.packagePrice + timeCost + kmCost,
  };
}

/**
 * One row per operator, for one of its car types: the one chosen for this
 * trip, or else the cheapest. Within that car, each rental takes its cheapest
 * tariff, and every tariff no rental uses is hidden as dearer. Each split
 * rental is priced on its own, since operators bill a new rental from zero.
 */
export function compareCarsharing(
  plans: PlanInput[],
  segments: RentalSegment[],
  wholeTrip: RentalSegment,
  isWeekend: boolean,
  chosen: Record<string, string> = {}
) {
  const hidden: HiddenPlan[] = [];
  const providers = new Map<string, Map<string, PlanInput[]>>();
  for (const plan of plans) {
    const cars = providers.get(plan.provider) ?? new Map<string, PlanInput[]>();
    cars.set(plan.carClass, [...(cars.get(plan.carClass) ?? []), plan]);
    providers.set(plan.provider, cars);
  }

  const usable = (group: PlanInput[]) => group.filter((plan) => isWeekend || !plan.weekendOnly);
  const cheapestFor = (group: PlanInput[], s: RentalSegment) =>
    usable(group)
      .map((plan) => ({ plan, total: planCost(plan, s.minutes, s.km, s.start) }))
      .reduce<{ plan: PlanInput; total: number } | null>((best, next) => (best && best.total <= next.total ? best : next), null);
  const price = (group: PlanInput[]) => {
    const picks = segments.map((s) => cheapestFor(group, s));
    const covered = picks.every((p) => p != null && Number.isFinite(p.total));
    return { picks, total: covered ? picks.reduce((sum, p) => sum + p!.total, 0) : null };
  };

  const visible = [...providers.entries()].map(([provider, cars]) => {
    const carClasses = bySize([...cars.keys()]);
    const priced = carClasses.map((carClass) => ({ carClass, ...price(cars.get(carClass)!) }));
    const cheapest = priced.reduce((best, next) => (next.total != null && (best.total == null || next.total < best.total) ? next : best));
    const pick = priced.find((p) => p.carClass === chosen[provider]) ?? cheapest;
    const group = cars.get(pick.carClass)!;

    const used = new Set(pick.picks.map((p) => p?.plan.id));
    for (const plan of group) {
      if (used.has(plan.id) && pick.total != null) continue;
      if (plan.weekendOnly && !isWeekend) {
        hidden.push({ ...plan, total: null, reason: "weekend", cheaperName: null });
        continue;
      }
      const total = segments.reduce((sum, s) => sum + planCost(plan, s.minutes, s.km, s.start), 0);
      hidden.push({ ...plan, total: Number.isFinite(total) ? total : null, reason: "dearer", cheaperName: pick.picks[0]?.plan.name ?? null });
    }
    const whole = cheapestFor(group, wholeTrip);
    return {
      provider,
      carClasses,
      carClass: pick.carClass,
      planNames: pick.total == null ? [] : pick.picks.map((p) => p!.plan.name),
      verified: pick.total == null || pick.picks.every((p) => p!.plan.verified),
      total: pick.total,
      unsplitTotal: whole && Number.isFinite(whole.total) ? whole.total : null,
      rentals: pick.total == null ? [] : pick.picks.map((p, i) => ({ plan: p!.plan, segment: segments[i] })),
    } satisfies TripOption;
  });

  return {
    // Fixed alphabetical order, so an operator stays in the same place whichever is cheapest.
    visible: visible.sort((a, b) => a.provider.localeCompare(b.provider)),
    hidden: hidden.sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity)),
  };
}

export type VehicleInput = {
  id: string;
  brand: string;
  model: string;
  fuelType: "PETROL" | "DIESEL";
  consumptionPer100Km: number;
  fuelPricePerLitre: number;
  amortizationPerKm: number;
  extraCostPerKm: number;
};

export function vehicleName(vehicle: { brand: string; model: string }) {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
}

/** Fuel, amortization and any other running cost for `km` in one of your own cars. */
export function vehicleCost(vehicle: VehicleInput, km: number) {
  const litres = (km / 100) * vehicle.consumptionPer100Km;
  const fuel = litres * vehicle.fuelPricePerLitre;
  const amortization = km * vehicle.amortizationPerKm;
  const other = km * vehicle.extraCostPerKm;
  return { litres, fuel, amortization, other, total: fuel + amortization + other };
}
