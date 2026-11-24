import { describe, expect, it } from "vitest";
import { dayCount, freePerDay, freeUnits, isDateKey, planCost, planReservation, rangesOverlap, type PlanBooking, type PlanUnit } from "../gear-reservations";
import { effectiveDayRate, paybackDays } from "../gear-pricing";

const units: PlanUnit[] = [
  { id: "fx3", typeId: "fx30", number: 3, active: true },
  { id: "fx1", typeId: "fx30", number: 1, active: true },
  { id: "fx2", typeId: "fx30", number: 2, active: true },
  { id: "fx4", typeId: "fx30", number: 4, active: false },
  { id: "l1", typeId: "lens", number: 1, active: true },
  { id: "l2", typeId: "lens", number: 2, active: true },
];

describe("rangesOverlap", () => {
  it("treats touching days as a collision, since whole days are booked", () => {
    expect(rangesOverlap({ startDate: "2026-11-24", endDate: "2026-11-27" }, { startDate: "2026-11-27", endDate: "2026-11-30" })).toBe(true);
  });
  it("lets back-to-back ranges through", () => {
    expect(rangesOverlap({ startDate: "2026-11-24", endDate: "2026-11-26" }, { startDate: "2026-11-27", endDate: "2026-11-30" })).toBe(false);
  });
  it("catches a range inside another and single days", () => {
    expect(rangesOverlap({ startDate: "2026-11-20", endDate: "2026-12-05" }, { startDate: "2026-11-27", endDate: "2026-11-27" })).toBe(true);
    expect(rangesOverlap({ startDate: "2026-11-27", endDate: "2026-11-27" }, { startDate: "2026-11-27", endDate: "2026-11-27" })).toBe(true);
    expect(rangesOverlap({ startDate: "2026-11-27", endDate: "2026-11-27" }, { startDate: "2026-11-28", endDate: "2026-11-28" })).toBe(false);
  });
  it("orders across a month and year boundary", () => {
    expect(rangesOverlap({ startDate: "2026-12-30", endDate: "2027-01-02" }, { startDate: "2027-01-01", endDate: "2027-01-01" })).toBe(true);
  });
});

describe("dates", () => {
  it("counts inclusive whole days", () => {
    expect(dayCount("2026-11-26", "2026-11-27")).toBe(2);
    expect(dayCount("2026-11-26", "2026-11-26")).toBe(1);
    expect(dayCount("2026-10-24", "2026-10-26")).toBe(3); // across the October clock change
  });
  it("accepts only real calendar dates", () => {
    expect(isDateKey("2026-11-26")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("26.11.2026")).toBe(false);
  });
});

describe("planReservation", () => {
  const range = { startDate: "2026-11-26", endDate: "2026-11-27" };

  it("takes the lowest free numbers first", () => {
    const [line] = planReservation([{ typeId: "fx30", quantity: 2 }], units, [], range);
    expect(line.units.map((u) => u.number)).toEqual([1, 2]);
    expect(line.shortBy).toBe(0);
  });

  it("skips booked and retired units", () => {
    const bookings: PlanBooking[] = [{ unitId: "fx1", startDate: "2026-11-27", endDate: "2026-11-30" }];
    const [line] = planReservation([{ typeId: "fx30", quantity: 2 }], units, bookings, range);
    expect(line.units.map((u) => u.number)).toEqual([2, 3]);
  });

  it("reports a shortfall instead of reserving less", () => {
    const bookings: PlanBooking[] = [{ unitId: "l1", startDate: "2026-11-20", endDate: "2026-11-26" }];
    const plan = planReservation([{ typeId: "fx30", quantity: 2 }, { typeId: "lens", quantity: 2 }], units, bookings, range);
    expect(plan[1].units.map((u) => u.number)).toEqual([2]);
    expect(plan[1].shortBy).toBe(1);
    expect(plan[0].shortBy).toBe(0);
  });

  it("never hands the same unit to two lines of one type", () => {
    const plan = planReservation([{ typeId: "fx30", quantity: 2 }, { typeId: "fx30", quantity: 2 }], units, [], range);
    expect(plan[0].units.map((u) => u.number)).toEqual([1, 2]);
    expect(plan[1].units.map((u) => u.number)).toEqual([3]);
    expect(plan[1].shortBy).toBe(1);
  });

  it("lists free units for a range", () => {
    const bookings: PlanBooking[] = [{ unitId: "fx2", startDate: "2026-11-24", endDate: "2026-11-26" }];
    expect(freeUnits("fx30", units, bookings, range).map((u) => u.number)).toEqual([1, 3]);
  });
});

describe("availability", () => {
  it("counts free active units per day", () => {
    const bookings: PlanBooking[] = [
      { unitId: "fx1", startDate: "2026-11-24", endDate: "2026-11-25" },
      { unitId: "fx2", startDate: "2026-11-25", endDate: "2026-11-25" },
      { unitId: "l1", startDate: "2026-11-24", endDate: "2026-11-26" },
    ];
    expect(freePerDay("fx30", units, bookings, ["2026-11-24", "2026-11-25", "2026-11-26"])).toEqual([2, 1, 3]);
  });
});

describe("pricing", () => {
  it("derives the auto rate as a rounded percentage of the price", () => {
    expect(effectiveDayRate({ purchasePrice: 52900, rateMode: "AUTO", ratePercent: 3, customDayRate: null })).toBe(1587);
    expect(effectiveDayRate({ purchasePrice: 7950, rateMode: "AUTO", ratePercent: 3, customDayRate: null })).toBe(239); // 238.5 rounds up
  });
  it("uses the custom rate as typed", () => {
    expect(effectiveDayRate({ purchasePrice: 79000, rateMode: "CUSTOM", ratePercent: 3, customDayRate: 2000 })).toBe(2000);
    expect(effectiveDayRate({ purchasePrice: 79000, rateMode: "CUSTOM", ratePercent: 3, customDayRate: null })).toBe(0);
  });
  it("works out the payback days", () => {
    expect(paybackDays({ purchasePrice: 52900, rateMode: "AUTO", ratePercent: 3, customDayRate: null })).toBe(34);
    expect(paybackDays({ purchasePrice: 0, rateMode: "AUTO", ratePercent: 3, customDayRate: null })).toBeNull();
  });
  it("prices a plan by the units it takes", () => {
    const plan = planReservation([{ typeId: "fx30", quantity: 2 }, { typeId: "lens", quantity: 3 }], units, [], { startDate: "2026-11-26", endDate: "2026-11-27" });
    expect(planCost(plan, new Map([["fx30", 1587], ["lens", 1650]]), 2)).toBe((2 * 1587 + 2 * 1650) * 2);
  });
});
