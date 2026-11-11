import type { PlanBands } from "@/lib/trip-cost";

/**
 * Starting carsharing tariffs. Inserted into CarsharingPlan the first time an
 * operator has no rows (see getCarsharingPlans) and edited from Settings →
 * Travel. `carClass` is the car type picked per trip.
 *
 * AutoGo, retrieved 2026-11-07, is copied from the published CSV behind
 * https://autogo.cz/cenova-kalkulacka/ (live sheet, not the page's stale
 * fallback table). Its demand-based pricing can still move the app's price.
 *
 * Car4way and Anytime come from the price list of 2026-11-11 (the shared
 * "Carsharing price comparison" sheet, Car4way from its Basic tariff). Where
 * the list leaves a rate out, it's filled from the same car and marked
 * `verified: false`.
 */
function bands(unit: PlanBands["unit"], rows: [number, number, number][]): string {
  return JSON.stringify({ unit, rows: rows.map(([from, time, km]) => ({ from, time, km })) } satisfies PlanBands);
}

const base = { packagePrice: 0, packageMinutes: null as number | null, packageKm: 0, minuteRate: 0, nightMinuteRate: 0, kmRate: 0, bandsJson: null as string | null, weekendOnly: false };

const AUTOGO = [
  {
    ...base,
    provider: "AutoGo",
    name: "Pay as you go",
    carClass: "Škoda Fabia",
    verified: true,
    bandsJson: bands("min", [[0, 2.9, 3.9], [60, 1.79, 2.49], [180, 1.09, 2.49], [360, 0.69, 2.49], [720, 0.39, 2.49], [1440, 0.29, 2.49]]),
  },
  {
    ...base,
    provider: "AutoGo",
    name: "Pay as you go",
    carClass: "Škoda Elroq",
    verified: true,
    bandsJson: bands("min", [[0, 3.9, 4.9], [60, 2.49, 3.09], [180, 1.49, 3.09], [360, 0.89, 3.09], [720, 0.59, 3.09], [1440, 0.39, 3.09]]),
  },
  {
    ...base,
    provider: "AutoGo",
    name: "Pay as you go",
    carClass: "Škoda Superb",
    verified: true,
    bandsJson: bands("min", [[0, 4.9, 5.9], [60, 3.09, 3.69], [180, 1.89, 3.69], [360, 1.19, 3.69], [720, 0.69, 3.69], [1440, 0.49, 3.69]]),
  },
  {
    ...base,
    provider: "AutoGo",
    name: "Pay as you go",
    carClass: "Mercedes Vito",
    verified: true,
    bandsJson: bands("hour", [[0, 299, 7.9], [60, 209, 5.49], [180, 129, 3.39], [360, 79, 3.39], [720, 49, 3.39], [1440, 39, 3.39]]),
  },
];

const HOUR = 60;
const DAY = 1440;

/** Anytime's ten packages, in the list's order: name, minutes, km included. */
const ANYTIME_PACKAGES: [string, number, number][] = [
  ["1+1 hodina zdarma", 2 * HOUR, 0],
  ["3 hodiny", 3 * HOUR, 0],
  ["6 hodin", 6 * HOUR, 0],
  ["6 hodin + 30 km", 6 * HOUR, 30],
  ["1 den", DAY, 0],
  ["1 den + 80 km", DAY, 80],
  ["2 dny", 2 * DAY, 0],
  ["3 dny + 300 km", 3 * DAY, 300],
  ["4 dny + 300 km", 4 * DAY, 300],
  ["7 dní", 7 * DAY, 0],
];
/** The first four packages are the hour ones; the rest are priced per day and have their own km rate. */
const ANYTIME_HOUR_PACKAGES = 4;

type AnytimeCar = {
  model: string;
  /** Kč/min and Kč/km without a package. A null minute rate isn't on the list. */
  minute: [number | null, number];
  prices: number[];
  /** Kč per km past the package, one per package. Null where the list doesn't show it. */
  km: (number | null)[];
  /** Packages whose price the list marks as only partly readable. */
  unsure?: number[];
};

const ANYTIME: AnytimeCar[] = [
  { model: "Toyota Yaris New", minute: [2.49, 5.99], prices: [109, 249, 349, 489, 489, 889, 789, 3299, 3599, 2849], km: [5.59, 5.59, 5.59, 5.59, 6.09, 6.09, 6.09, 6.09, 6.09, 6.09] },
  { model: "Toyota Yaris", minute: [1.99, 5.69], prices: [99, 189, 289, 419, 439, 819, 699, 2999, 3299, 2599], km: [5.59, 5.59, 5.59, 5.59, 5.99, 5.99, 5.99, 5.99, 5.99, 5.99] },
  {
    model: "Toyota Yaris Cross",
    minute: [3.2, 6.79],
    prices: [129, 279, 419, 519, 529, 979, 849, 3549, 3899, 3149],
    km: [6.79, 6.79, 6.79, 6.79, 6.89, 6.89, 6.89, 6.89, 6.89, 6.89],
    unsure: [2],
  },
  { model: "Fiat Panda", minute: [null, 6.19], prices: [119, 259, 369, 499, 499, 929, 809, 3399, 3699, 2899], km: [6.09, 6.09, 6.09, 6.09, 6.39, 6.39, null, 6.39, 6.39, 6.39] },
  { model: "Toyota Aygo X Economy", minute: [1.99, 5.69], prices: [89, 169, 279, 419, 419, 779, 659, 2999, 3299, 2499], km: [5.69, 5.69, 5.69, 5.69, 5.99, 5.99, 5.99, 5.99, 5.99, 5.99] },
  { model: "Toyota C-HR", minute: [3.1, 6.59], prices: [129, 259, 369, 479, 499, 919, 799, 3499, 3799, 2899], km: [6.39, null, null, null, 6.79, null, null, null, null, null] },
  { model: "Toyota Aygo X", minute: [1.99, 5.69], prices: [89, 169, 279, 419, 419, 779, 659, 2999, 3299, 2499], km: [5.69, 5.69, 5.69, 5.69, 5.99, 5.99, 5.99, 5.99, 5.99, 5.99] },
  { model: "Toyota Corolla Impress", minute: [3.59, 6.99], prices: [129, 289, 429, 629, 599, 1149, 959, 4099, 4499, 3499], km: [7.29, null, null, null, 7.39, null, null, null, null, null] },
  { model: "Toyota C-HR Impress", minute: [3.69, 6.89], prices: [129, 289, 449, 589, 599, 1099, 959, 4099, 4499, 3339], km: [null, 7.29, null, null, 7.39, null, null, null, null, null] },
  { model: "Toyota Yaris Cross Impress", minute: [3.89, 7.79], prices: [139, 299, 449, 579, 599, 1199, 949, 3899, 4299, 3299], km: [7.19, null, 7.19, null, 7.39, null, null, null, null, null] },
];

/** A km rate the list leaves out: the same car's rate for packages of the same length (hour or day), else its other one. */
function fillKmRate(car: AnytimeCar, i: number) {
  const known = (from: number, to: number) => car.km.slice(from, to).filter((k): k is number => k != null);
  const sameTier = i < ANYTIME_HOUR_PACKAGES ? known(0, ANYTIME_HOUR_PACKAGES) : known(ANYTIME_HOUR_PACKAGES, car.km.length);
  const any = known(0, car.km.length);
  return Math.max(...(sameTier.length ? sameTier : any));
}

const ANYTIME_PLANS = ANYTIME.flatMap((car) => {
  const [minuteRate, minuteKm] = car.minute;
  const packages = ANYTIME_PACKAGES.map(([name, minutes, km], i) => ({
    ...base,
    provider: "Anytime",
    name,
    carClass: car.model,
    packagePrice: car.prices[i],
    packageMinutes: minutes,
    packageKm: km,
    // Without a published minute rate a package can't run past its time (see planCost).
    minuteRate: minuteRate ?? 0,
    kmRate: car.km[i] ?? fillKmRate(car, i),
    verified: car.km[i] != null && !car.unsure?.includes(i),
  }));
  const minutes =
    minuteRate == null ? [] : [{ ...base, provider: "Anytime", name: "Minuty", carClass: car.model, minuteRate, kmRate: minuteKm, verified: true }];
  return [...minutes, ...packages];
});

/** Car4way's packages: name, minutes, km included. The weekend runs Friday 16:00 to Monday 10:00. */
const CAR4WAY_PACKAGES: [string, number, number][] = [
  ["2 hodiny", 2 * HOUR, 10],
  ["6 hodin", 6 * HOUR, 20],
  ["24 hodin", DAY, 20],
  ["48 hodin", 2 * DAY, 40],
  ["Víkend pá 16h–po 10h", 66 * HOUR, 200],
  ["4 dny", 4 * DAY, 150],
  ["Týden", 7 * DAY, 50],
  ["10 dní", 10 * DAY, 200],
];
const CAR4WAY_WEEKEND = 4;
const CAR4WAY_KM = 9.49;
const CAR4WAY_PRICES = {
  large: [467, 764, 934, 1614, 2635, 2635, 3485, 6035],
  middle: [339, 594, 764, 1359, 2253, 2253, 3103, 5738],
  small: [212, 424, 594, 1012, 1785, 1785, 2720, 5347],
};

/** Minute rates 6:00–20:00 and 20:00–6:00. Scala's day rate isn't on the list: Car4way's is always 0.80 below the night rate. */
const CAR4WAY: { model: string; prices: number[]; day: number; night: number; dayEstimated?: boolean }[] = [
  { model: "Škoda Formentor", prices: CAR4WAY_PRICES.large, day: 8.79, night: 9.59 },
  { model: "Škoda Kamiq", prices: CAR4WAY_PRICES.middle, day: 7.19, night: 7.99 },
  { model: "Škoda Superb", prices: CAR4WAY_PRICES.large, day: 8.79, night: 9.59 },
  { model: "Škoda Kodiaq", prices: CAR4WAY_PRICES.large, day: 8.79, night: 9.59 },
  { model: "Škoda Fabia", prices: CAR4WAY_PRICES.small, day: 5.59, night: 6.39 },
  { model: "Škoda Octavia", prices: CAR4WAY_PRICES.middle, day: 7.19, night: 7.99 },
  { model: "Škoda Scala", prices: CAR4WAY_PRICES.middle, day: 7.19, night: 7.99, dayEstimated: true },
  { model: "Škoda Karoq", prices: CAR4WAY_PRICES.middle, day: 7.19, night: 7.99 },
];

const CAR4WAY_PLANS = CAR4WAY.flatMap((car) => {
  const rates = { minuteRate: car.day, nightMinuteRate: car.night, kmRate: CAR4WAY_KM };
  return [
    { ...base, ...rates, provider: "Car4way", name: "Minuty", carClass: car.model, verified: !car.dayEstimated },
    ...CAR4WAY_PACKAGES.map(([name, minutes, km], i) => ({
      ...base,
      ...rates,
      provider: "Car4way",
      name,
      carClass: car.model,
      packagePrice: car.prices[i],
      packageMinutes: minutes,
      packageKm: km,
      weekendOnly: i === CAR4WAY_WEEKEND,
      verified: !car.dayEstimated,
    })),
  ];
});

export const DEFAULT_CARSHARING_PLANS = [...AUTOGO, ...CAR4WAY_PLANS, ...ANYTIME_PLANS].map((plan, i) => ({ ...plan, sortOrder: i }));

/** CCS average pump prices reported for early November 2026, Kč/l. */
export const DEFAULT_FUEL_PRICE = { PETROL: 42.39, DIESEL: 48.08 } as const;

/** Wear and loss of value of an own car, Kč per km. Each car can change it in Settings → Travel. */
export const DEFAULT_AMORTIZATION_PER_KM = 5.9;

/**
 * Used until a user adds their own car. Owner-reported figures for the
 * Octavia III run 4.7–5.0 l/100 km for the TDI engines and about 6.0 for the
 * 1.4 TSI (honestjohn.co.uk Real MPG); the diesel is the common one here.
 */
export const DEFAULT_VEHICLE = {
  id: "default",
  brand: "Škoda",
  model: "Octavia 3",
  fuelType: "DIESEL",
  consumptionPer100Km: 5,
  fuelPricePerLitre: DEFAULT_FUEL_PRICE.DIESEL,
  amortizationPerKm: DEFAULT_AMORTIZATION_PER_KM,
  extraCostPerKm: 0,
} as const;
