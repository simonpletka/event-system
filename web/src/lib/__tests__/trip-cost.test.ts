import { describe, expect, it } from "vitest";
import { compareCarsharing, daytimeMinutes, planBreakdown, planCost, vehicleCost, vehicleName, type PlanInput } from "../trip-cost";
import { DEFAULT_CARSHARING_PLANS, DEFAULT_VEHICLE } from "../carsharing-defaults";

const plans: PlanInput[] = DEFAULT_CARSHARING_PLANS.map((p, i) => ({ ...p, id: `p${i}` }));
const find = (provider: string, carClass: string, name: string) => plans.find((p) => p.provider === provider && p.carClass === carClass && p.name === name)!;

describe("carsharing prices", () => {
  it("carries the 11 Nov 2026 list: Anytime and Car4way per car type", () => {
    const yaris = find("Anytime", "Toyota Yaris", "1 den + 80 km");
    expect([yaris.packagePrice, yaris.packageMinutes, yaris.packageKm, yaris.kmRate, yaris.verified]).toEqual([819, 1440, 80, 5.99, true]);
    const fabia = find("Car4way", "Škoda Fabia", "Minuty");
    expect([fabia.minuteRate, fabia.nightMinuteRate, fabia.kmRate]).toEqual([5.59, 6.39, 9.49]);
    expect(find("Car4way", "Škoda Kamiq", "Víkend pá 16h–po 10h")).toMatchObject({ packagePrice: 2253, packageMinutes: 3960, weekendOnly: true });
  });

  it("fills a missing km rate from the same car and marks it unverified", () => {
    const chr = find("Anytime", "Toyota C-HR", "3 hodiny");
    expect(chr.kmRate).toBe(6.39);
    expect(chr.verified).toBe(false);
  });

  it("gives Fiat Panda no minute tariff, so its packages can't run over", () => {
    expect(plans.some((p) => p.carClass === "Fiat Panda" && p.name === "Minuty")).toBe(false);
    expect(planCost(find("Anytime", "Fiat Panda", "3 hodiny"), 200, 0)).toBe(Infinity);
  });

  it("bills Car4way minutes at the night rate between 20:00 and 6:00", () => {
    expect(daytimeMinutes(19 * 60, 120)).toBe(60);
    expect(daytimeMinutes(23 * 60, 8 * 60)).toBe(60);
    const minutes = find("Car4way", "Škoda Fabia", "Minuty");
    // 19:00–21:00: an hour at 5.59, an hour at 6.39, plus 10 km.
    expect(planCost(minutes, 120, 10, 19 * 60)).toBeCloseTo(60 * 5.59 + 60 * 6.39 + 94.9);
    expect(planCost(minutes, 120, 10, null)).toBeCloseTo(120 * 5.59 + 94.9);
  });
});

describe("price breakdown", () => {
  it("itemises a package: price, extra time and extra km", () => {
    const plan = find("Anytime", "Toyota Yaris", "6 hodin + 30 km");
    const b = planBreakdown(plan, 7 * 60, 100, 9 * 60);
    expect(b).toMatchObject({ kind: "package", packagePrice: 419, extraMinutes: 60, extraKm: 70, kmRate: 5.59 });
    if (b.kind !== "package") throw new Error();
    expect(b.timeCost).toBeCloseTo(60 * 1.99);
    expect(b.kmCost).toBeCloseTo(70 * 5.59);
    expect(b.total).toBeCloseTo(planCost(plan, 7 * 60, 100, 9 * 60));
  });

  it("splits AutoGo's band price into time and km", () => {
    const b = planBreakdown(find("AutoGo", "Škoda Fabia", "Pay as you go"), 60, 20);
    expect(b).toMatchObject({ kind: "bands", km: 20 });
    if (b.kind !== "bands") throw new Error();
    expect(b.time).toBeCloseTo(60 * 2.9);
    expect(b.kmCost).toBeCloseTo(20 * 3.9);
  });
});

describe("comparing carsharing", () => {
  const trip = { minutes: 5 * 60, km: 40, start: 9 * 60 };

  it("shows one row per operator, priced with the chosen car type", () => {
    const { visible } = compareCarsharing(plans, [trip], trip, false, { Anytime: "Toyota C-HR" });
    expect(visible.map((v) => v.provider)).toEqual(["Anytime", "AutoGo", "Car4way"]);
    const anytime = visible.find((v) => v.provider === "Anytime")!;
    expect(anytime.carClass).toBe("Toyota C-HR");
    expect(anytime.carClasses).toContain("Toyota Yaris");
  });

  it("lists each operator's cars from smallest to biggest", () => {
    const { visible } = compareCarsharing(plans, [trip], trip, false);
    const cars = (provider: string) => visible.find((v) => v.provider === provider)!.carClasses;
    expect(cars("Anytime").slice(0, 3)).toEqual(["Fiat Panda", "Toyota Aygo X Economy", "Toyota Aygo X"]);
    expect(cars("Anytime").at(-1)).toBe("Toyota Corolla Impress");
    expect(cars("Car4way")).toEqual([
      "Škoda Fabia",
      "Škoda Kamiq",
      "Škoda Formentor",
      "Škoda Scala",
      "Škoda Karoq",
      "Škoda Octavia",
      "Škoda Superb",
      "Škoda Kodiaq",
    ]);
    expect(cars("AutoGo")).toEqual(["Škoda Fabia", "Škoda Elroq", "Škoda Superb", "Mercedes Vito"]);
  });

  it("falls back to the operator's cheapest car when none is chosen", () => {
    const { visible } = compareCarsharing(plans, [trip], trip, false);
    expect(visible.find((v) => v.provider === "Car4way")!.carClass).toBe("Škoda Fabia");
  });

  it("hides the chosen car's dearer packages and keeps the cheapest", () => {
    const { visible, hidden } = compareCarsharing(plans, [trip], trip, false, { Anytime: "Toyota Yaris" });
    const anytime = visible.find((v) => v.provider === "Anytime")!;
    const shown = find("Anytime", "Toyota Yaris", anytime.planNames[0]);
    const yarisHidden = hidden.filter((h) => h.provider === "Anytime");
    expect(yarisHidden.every((h) => h.carClass === "Toyota Yaris")).toBe(true);
    expect(yarisHidden.length).toBe(10);
    for (const h of yarisHidden) if (h.total != null) expect(h.total).toBeGreaterThanOrEqual(anytime.total!);
    expect(planCost(shown, trip.minutes, trip.km, trip.start)).toBeCloseTo(anytime.total!);
  });

  it("only offers Car4way's weekend package at the weekend", () => {
    const weekend = { minutes: 2 * 1440, km: 300, start: 17 * 60 };
    const weekday = compareCarsharing(plans, [weekend], weekend, false, { Car4way: "Škoda Kamiq" });
    expect(weekday.hidden.find((h) => h.name.startsWith("Víkend") && h.carClass === "Škoda Kamiq")?.reason).toBe("weekend");
    const sat = compareCarsharing(plans, [weekend], weekend, true, { Car4way: "Škoda Kamiq" });
    expect(sat.visible.find((v) => v.provider === "Car4way")!.planNames[0]).toMatch(/^Víkend/);
  });
});

describe("own car", () => {
  it("adds 5.90 Kč/km amortization to the fuel", () => {
    const cost = vehicleCost(DEFAULT_VEHICLE, 100);
    expect(cost.litres).toBe(5);
    expect(cost.fuel).toBeCloseTo(5 * 48.08);
    expect(cost.amortization).toBeCloseTo(590);
    expect(cost.total).toBeCloseTo(5 * 48.08 + 590);
    expect(vehicleName(DEFAULT_VEHICLE)).toBe("Škoda Octavia 3");
  });
});
