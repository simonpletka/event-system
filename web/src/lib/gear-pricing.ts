/**
 * Gear day rental rates. The rate is derived on read, never stored, so a
 * changed purchase price or percentage can't leave a stale rate behind.
 * Every amount is whole CZK, excl. VAT. Client-safe (no imports).
 */

export const DEFAULT_RATE_PERCENT = 3;

export type GearPricing = {
  purchasePrice: number;
  rateMode: "AUTO" | "CUSTOM";
  ratePercent: number;
  customDayRate: number | null;
};

/** AUTO: ratePercent of the purchase price, rounded to whole CZK. CUSTOM: the typed rate (0 when missing). */
export function effectiveDayRate(type: GearPricing) {
  if (type.rateMode === "CUSTOM") return Math.max(0, Math.round(type.customDayRate ?? 0));
  return Math.max(0, Math.round((type.purchasePrice * type.ratePercent) / 100));
}

/** Rental days until one unit has earned its purchase price, or null when it never will (no rate) or cost nothing. */
export function paybackDays(type: GearPricing) {
  const rate = effectiveDayRate(type);
  if (rate <= 0 || type.purchasePrice <= 0) return null;
  return Math.ceil(type.purchasePrice / rate);
}
