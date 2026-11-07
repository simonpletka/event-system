import type { PlanBands } from "@/lib/trip-cost";

/**
 * Starting carsharing tariffs, retrieved 2026-11-07. Inserted once into
 * CarsharingPlan (see getCarsharingPlans) and edited from Settings → Travel.
 *
 * AutoGo is complete: copied from the published CSV behind
 * https://autogo.cz/cenova-kalkulacka/ (live sheet, not the page's stale
 * fallback table). Its demand-based pricing can still move the app's price.
 *
 * Car4way and Anytime publish only "from" prices (car4way.cz/carsharing/cenik,
 * anytimecar.cz/ceny/) and keep the rest in their apps. `verified: false`
 * rows use those floor prices; the 4.90 / 4.99 Kč/km rates are the last
 * published figures, from a 2020 auto.cz article — replace from the app.
 */
const ASSUMED_CAR4WAY_KM = 4.9;
const ASSUMED_ANYTIME_KM = 4.99;

function bands(unit: PlanBands["unit"], rows: [number, number, number][]): string {
  return JSON.stringify({ unit, rows: rows.map(([from, time, km]) => ({ from, time, km })) } satisfies PlanBands);
}

const base = { packagePrice: 0, packageMinutes: null, packageKm: 0, minuteRate: 0, kmRate: 0, bandsJson: null, weekendOnly: false };

export const DEFAULT_CARSHARING_PLANS = [
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
  { ...base, provider: "Car4way", name: "Minutes", carClass: "Cheapest class", minuteRate: 4.79, kmRate: ASSUMED_CAR4WAY_KM, verified: false },
  {
    ...base,
    provider: "Car4way",
    name: "2 hours · 10 km",
    carClass: "Cheapest class",
    packagePrice: 187,
    packageMinutes: 120,
    packageKm: 10,
    minuteRate: 4.79,
    kmRate: ASSUMED_CAR4WAY_KM,
    verified: false,
  },
  {
    ...base,
    provider: "Car4way",
    name: "Weekend · 200 km",
    carClass: "Cheapest class",
    packagePrice: 1607,
    packageMinutes: 2880,
    packageKm: 200,
    minuteRate: 4.79,
    kmRate: ASSUMED_CAR4WAY_KM,
    weekendOnly: true,
    verified: false,
  },
  {
    ...base,
    provider: "Car4way",
    name: "10 days · 200 km",
    carClass: "Cheapest class",
    packagePrice: 4837,
    packageMinutes: 14400,
    packageKm: 200,
    minuteRate: 4.79,
    kmRate: ASSUMED_CAR4WAY_KM,
    verified: false,
  },
  { ...base, provider: "Anytime", name: "Minutes", carClass: "Economy", minuteRate: 0.99, kmRate: ASSUMED_ANYTIME_KM, verified: false },
  {
    ...base,
    provider: "Anytime",
    name: "1 hour",
    carClass: "Economy",
    packagePrice: 89,
    packageMinutes: 60,
    minuteRate: 0.99,
    kmRate: ASSUMED_ANYTIME_KM,
    verified: false,
  },
  {
    ...base,
    provider: "Anytime",
    name: "1 day",
    carClass: "Economy",
    packagePrice: 399,
    packageMinutes: 1440,
    minuteRate: 0.99,
    kmRate: ASSUMED_ANYTIME_KM,
    verified: false,
  },
].map((plan, i) => ({ ...plan, sortOrder: i }));

/** CCS average pump prices reported for early November 2026, Kč/l. */
export const DEFAULT_FUEL_PRICE = { PETROL: 42.39, DIESEL: 48.08 } as const;

/**
 * Used until a user adds their own car. Owner-reported figures for the
 * Octavia III run 4.7–5.0 l/100 km for the TDI engines and about 6.0 for the
 * 1.4 TSI (honestjohn.co.uk Real MPG); the diesel is the common one here.
 */
export const DEFAULT_VEHICLE = {
  id: "default",
  name: "Škoda Octavia 3",
  fuelType: "DIESEL",
  consumptionPer100Km: 5,
  fuelPricePerLitre: DEFAULT_FUEL_PRICE.DIESEL,
  extraCostPerKm: 0,
} as const;
