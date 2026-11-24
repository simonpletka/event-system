import { describe, expect, it } from "vitest";
import { dayCount, freePerDay, freeUnits, isDateKey, isOverdue, planCost, planReservation, rangesOverlap, reassignTarget, unitUsableOn, usablePerDay, type PlanBooking, type PlanUnit } from "../gear-reservations";
import { pickupBlockReason } from "../gear-events";
import { GEAR_CODE_ALPHABET, generateGearCode, normalizeGearCode } from "../gear-code";
import { parseGearScanInput } from "../gear-scan";
import { effectiveDayRate, paybackDays } from "../gear-pricing";

const units: PlanUnit[] = [
  { id: "fx3", typeId: "fx30", number: 3, condition: "OK" },
  { id: "fx1", typeId: "fx30", number: 1, condition: "OK" },
  { id: "fx2", typeId: "fx30", number: 2, condition: "OK" },
  { id: "fx4", typeId: "fx30", number: 4, condition: "RETIRED" },
  { id: "l1", typeId: "lens", number: 1, condition: "OK" },
  { id: "l2", typeId: "lens", number: 2, condition: "OK" },
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
  it("counts free usable units per day", () => {
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

describe("condition", () => {
  const cams: PlanUnit[] = [
    { id: "a", typeId: "cam", number: 1, condition: "OK" },
    { id: "b", typeId: "cam", number: 2, condition: "NEEDS_ATTENTION" },
    { id: "c", typeId: "cam", number: 3, condition: "DAMAGED" },
    { id: "d", typeId: "cam", number: 4, condition: "IN_SERVICE", backAt: "2026-11-27" },
    { id: "e", typeId: "cam", number: 5, condition: "IN_SERVICE", backAt: null },
    { id: "f", typeId: "cam", number: 6, condition: "LOST" },
    { id: "g", typeId: "cam", number: 7, condition: "RETIRED" },
  ];

  it("ignores damaged, in-service, lost and retired units; needs-attention stays bookable", () => {
    expect(freeUnits("cam", cams, [], { startDate: "2026-11-25", endDate: "2026-11-25" }).map((u) => u.number)).toEqual([1, 2]);
  });

  it("keeps an in-service unit out until its backAt day, inclusive", () => {
    expect(unitUsableOn(cams[3], "2026-11-27")).toBe(false);
    expect(unitUsableOn(cams[3], "2026-11-28")).toBe(true);
    expect(freeUnits("cam", cams, [], { startDate: "2026-11-27", endDate: "2026-11-29" }).map((u) => u.number)).toEqual([1, 2]);
    expect(freeUnits("cam", cams, [], { startDate: "2026-11-28", endDate: "2026-11-29" }).map((u) => u.number)).toEqual([1, 2, 4]);
    expect(unitUsableOn(cams[4], "2099-01-01")).toBe(false);
  });

  it("counts usable units per day the same way as free ones", () => {
    const days = ["2026-11-27", "2026-11-28"];
    expect(usablePerDay("cam", cams, days)).toEqual([2, 3]);
    expect(freePerDay("cam", cams, [], days)).toEqual([2, 3]);
  });
});

describe("pick-up and late returns", () => {
  const one: PlanUnit[] = [
    { id: "a", typeId: "cam", number: 1, condition: "OK" },
    { id: "b", typeId: "cam", number: 2, condition: "OK" },
  ];
  const late: PlanBooking = { unitId: "a", startDate: "2026-11-20", endDate: "2026-11-22", pickedUpAt: "2026-11-20T08:00:00Z", returnedAt: null };

  it("keeps an unreturned unit blocked past its end date until it comes back", () => {
    const range = { startDate: "2026-11-25", endDate: "2026-11-25" };
    expect(isOverdue(late, "2026-11-25")).toBe(true);
    expect(freeUnits("cam", one, [late], range, "2026-11-25").map((u) => u.number)).toEqual([2]);
    expect(freePerDay("cam", one, [late], ["2026-11-25"], "2026-11-25")).toEqual([1]);
    const back = { ...late, returnedAt: "2026-11-25T09:00:00Z" };
    expect(freeUnits("cam", one, [back], range, "2026-11-25").map((u) => u.number)).toEqual([1, 2]);
  });

  it("doesn't block days after today for a late unit, only up to today", () => {
    expect(freeUnits("cam", one, [late], { startDate: "2026-11-26", endDate: "2026-11-26" }, "2026-11-25").map((u) => u.number)).toEqual([1, 2]);
  });

  const booking = (condition: PlanUnit["condition"], extra: Partial<{ pickedUpAt: string; returnedAt: string; startDate: string }> = {}) => ({
    startDate: extra.startDate ?? "2026-11-25",
    endDate: "2026-11-27",
    pickedUpAt: extra.pickedUpAt ?? null,
    returnedAt: extra.returnedAt ?? null,
    unit: { condition, backAt: null },
  });

  it("blocks pick-up for unusable units and allows needs-attention", () => {
    expect(pickupBlockReason(booking("DAMAGED"), "2026-11-25")).toBe("unusable");
    expect(pickupBlockReason(booking("IN_SERVICE"), "2026-11-25")).toBe("unusable");
    expect(pickupBlockReason(booking("LOST"), "2026-11-25")).toBe("unusable");
    expect(pickupBlockReason(booking("NEEDS_ATTENTION"), "2026-11-25")).toBeNull();
    expect(pickupBlockReason(booking("OK"), "2026-11-25")).toBeNull();
  });

  it("opens pick-up the day before and refuses twice", () => {
    expect(pickupBlockReason(booking("OK", { startDate: "2026-11-26" }), "2026-11-25")).toBeNull();
    expect(pickupBlockReason(booking("OK", { startDate: "2026-11-27" }), "2026-11-25")).toBe("window");
    expect(pickupBlockReason(booking("OK", { pickedUpAt: "x" }), "2026-11-25")).toBe("already");
    expect(pickupBlockReason(booking("OK", { returnedAt: "x" }), "2026-11-25")).toBe("returned");
  });
});

describe("reassign", () => {
  const cams: PlanUnit[] = [
    { id: "a", typeId: "cam", number: 1, condition: "OK" },
    { id: "b", typeId: "cam", number: 2, condition: "DAMAGED" },
    { id: "c", typeId: "cam", number: 3, condition: "OK" },
  ];
  const range = { startDate: "2026-11-26", endDate: "2026-11-27" };

  it("moves the booking to a free unit and never to the broken one", () => {
    const busy: PlanBooking[] = [{ unitId: "a", startDate: "2026-11-27", endDate: "2026-11-27" }];
    expect(reassignTarget({ ...range, unitId: "b" }, "cam", cams, busy)?.number).toBe(3);
  });

  it("returns null when nothing else is free", () => {
    const busy: PlanBooking[] = [
      { unitId: "a", ...range },
      { unitId: "c", ...range },
    ];
    expect(reassignTarget({ ...range, unitId: "b" }, "cam", cams, busy)).toBeNull();
  });
});

describe("unit codes", () => {
  it("are 8 characters of Crockford base32 and don't repeat", () => {
    const codes = new Set(Array.from({ length: 5000 }, () => generateGearCode()));
    expect(codes.size).toBe(5000);
    for (const code of codes) {
      expect(code).toHaveLength(8);
      for (const ch of code) expect(GEAR_CODE_ALPHABET).toContain(ch);
    }
    expect(GEAR_CODE_ALPHABET).not.toMatch(/[ILOU]/);
  });

  it("reads a code the way people type it", () => {
    expect(normalizeGearCode("ab12-cd3e")).toBe("AB12CD3E");
    expect(normalizeGearCode("oi1l 2345")).toBe("0111" + "2345");
    expect(normalizeGearCode("ABC")).toBeNull();
    expect(normalizeGearCode("ABCDEFGU")).toBeNull();
  });

  it("parses a scan: full URL, relative URL, bare code, tag id, garbage", () => {
    expect(parseGearScanInput("https://app.example.com/g/AB12CD3E")).toEqual({ code: "AB12CD3E", tagUid: null });
    expect(parseGearScanInput("/g/ab12-cd3e?x=1")).toEqual({ code: "AB12CD3E", tagUid: null });
    expect(parseGearScanInput("https://evil.example.com/other/AB12CD3E")).toBeNull();
    expect(parseGearScanInput(" ab12cd3e ")?.code).toBe("AB12CD3E");
    expect(parseGearScanInput("E2:00:68:94")).toEqual({ code: null, tagUid: "E2:00:68:94" });
    expect(parseGearScanInput("")).toBeNull();
    expect(parseGearScanInput("<script>")).toBeNull();
  });
});
