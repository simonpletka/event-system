"use client";

import { Fragment, useState, useTransition } from "react";
import { setTripCarsharingModelAction } from "@/lib/actions/trips";
import { compareCarsharing, planBreakdown, vehicleCost, vehicleName, type PlanInput, type TripOption, type VehicleInput } from "@/lib/trip-cost";
import type { RentalSegment } from "@/lib/trip-schedule";
import { formatCurrency, formatDurationShort } from "@/lib/format";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

type T = Dictionary["projects"]["trips"];

/**
 * Own cars and one row per carsharing operator, with that operator's car type
 * picked here. Pricing reruns in the browser on each pick, and an editor's
 * pick is saved on the trip so the whole team sees the same comparison.
 */
export function TripCostTable({
  tripId,
  canSave,
  plans,
  segments,
  wholeTrip,
  isWeekend,
  isSplit,
  initialModels,
  vehicles,
  km,
  usingDefaultVehicle,
  locale,
}: {
  tripId: string;
  canSave: boolean;
  plans: PlanInput[];
  segments: RentalSegment[];
  wholeTrip: RentalSegment;
  isWeekend: boolean;
  isSplit: boolean;
  initialModels: Record<string, string>;
  vehicles: VehicleInput[];
  km: number;
  usingDefaultVehicle: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).projects.trips;
  const [models, setModels] = useState(initialModels);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const { visible, hidden } = compareCarsharing(plans, segments, wholeTrip, isWeekend, models);
  // Hidden tariffs under their operator, operators in the same alphabetical order as the rows; cheapest first within each.
  const hiddenByProvider = visible
    .map((option) => [option.provider, hidden.filter((plan) => plan.provider === option.provider)] as const)
    .filter(([, plans]) => plans.length > 0);

  const rowClass = (expanded: boolean) => `cursor-pointer hover:bg-ink/[0.03] ${expanded ? "" : "border-b border-ink/13"}`;
  /** A click anywhere in a row opens its breakdown, except on the controls inside it. */
  function rowClick(e: React.MouseEvent, key: string) {
    if ((e.target as HTMLElement).closest("select, button, a, input")) return;
    toggle(key);
  }

  function toggle(key: string) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function choose(provider: string, carClass: string) {
    setModels((cur) => ({ ...cur, [provider]: carClass }));
    if (!canSave) return;
    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("provider", provider);
    formData.set("carClass", carClass);
    startTransition(async () => {
      await setTripCarsharingModelAction(formData);
    });
  }

  return (
    <>
      <table className="w-full mt-2 text-[13px]">
        <tbody>
          {vehicles.map((car) => {
            const cost = vehicleCost(car, km);
            const key = `car-${car.id}`;
            const expanded = open.has(key);
            return (
              <Fragment key={key}>
                <tr className={rowClass(expanded)} onClick={(e) => rowClick(e, key)}>
                  <td className="py-1.5">
                    {vehicleName(car)}
                    <div className="text-[11px] placeholder-text">{t.ownCarDetail(car.consumptionPer100Km, cost.litres.toFixed(1), car.fuelPricePerLitre)}</div>
                  </td>
                  <td className="py-1.5 text-right align-top whitespace-nowrap">
                    <div className="font-semibold tabular-nums">{formatCurrency(Math.round(cost.total))}</div>
                    <BreakdownToggle id={`breakdown-${tripId}-${key}`} expanded={expanded} onToggle={() => toggle(key)} label={t.breakdown} />
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-ink/13">
                    <td colSpan={2} id={`breakdown-${tripId}-${key}`} className="pb-2.5">
                      <CarBreakdown car={car} km={km} t={t} locale={locale} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {visible.map((option) => {
            const expanded = open.has(option.provider);
            return (
              <Fragment key={option.provider}>
                <tr
                  className={option.rentals.length > 0 ? rowClass(expanded) : "border-b border-ink/13"}
                  onClick={option.rentals.length > 0 ? (e) => rowClick(e, option.provider) : undefined}
                >
                  <td className="py-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        {option.provider}
                        {option.planNames.length > 0 && ` · ${[...new Set(option.planNames)].join(" + ")}`}
                      </span>
                      {option.carClasses.length > 1 ? (
                        <select
                          value={option.carClass}
                          onChange={(e) => choose(option.provider, e.target.value)}
                          aria-label={t.carTypeFor(option.provider)}
                          className="input !py-1 !px-2 !text-[12px] max-w-full"
                        >
                          {option.carClasses.map((carClass) => (
                            <option key={carClass} value={carClass}>
                              {carClass}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="placeholder-text">{option.carClass}</span>
                      )}
                    </div>
                    <div className="text-[11px] placeholder-text">
                      {option.total == null && t.noTariffCovers}
                      {option.total != null && !option.verified && t.unverified}
                      {option.total != null && isSplit && option.unsplitTotal != null && `${option.verified ? "" : " · "}${t.withoutSplit(formatCurrency(Math.round(option.unsplitTotal)))}`}
                    </div>
                  </td>
                  <td className="py-1.5 text-right align-top whitespace-nowrap">
                    <div className="font-semibold tabular-nums">{option.total == null ? "—" : formatCurrency(Math.round(option.total))}</div>
                    {option.rentals.length > 0 && (
                      <BreakdownToggle
                        id={`breakdown-${tripId}-${option.provider}`}
                        expanded={expanded}
                        onToggle={() => toggle(option.provider)}
                        label={t.breakdown}
                      />
                    )}
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-ink/13">
                    <td colSpan={2} id={`breakdown-${tripId}-${option.provider}`} className="pb-2.5">
                      <Breakdown option={option} t={t} locale={locale} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {usingDefaultVehicle && <p className="text-[11px] placeholder-text mt-2">{t.defaultVehicleNote}</p>}
      <p className="text-[11px] placeholder-text mt-2 max-w-prose">{t.costNote}</p>

      {hidden.length > 0 && (
        <details className="mt-2 text-[12px]">
          <summary className="placeholder-text">{t.hiddenPlans(hidden.length)}</summary>
          <div className="mt-1.5 space-y-2.5">
            {hiddenByProvider.map(([provider, plans]) => (
              <div key={provider}>
                <div className="label !text-[10px] mb-1">{provider}</div>
                <ul className="space-y-1">
                  {plans.map((plan) => (
                    <li key={plan.id} className="flex justify-between gap-3">
                      <span>
                        {plan.carClass} · {plan.name}
                        <span className="placeholder-text">
                          {" — "}
                          {plan.reason === "weekend" ? t.hiddenWeekend : plan.total == null ? t.hiddenTooShort : t.hiddenDearer(plan.cheaperName ?? "")}
                        </span>
                      </span>
                      {plan.total != null && <span className="tabular-nums whitespace-nowrap">{formatCurrency(Math.round(plan.total))}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

/** Per rental: the package and what it includes, the extra time and km on top, and the total. */
function Breakdown({ option, t, locale }: { option: TripOption; t: T; locale: Locale }) {
  const number = (n: number) => n.toLocaleString(locale === "cs" ? "cs-CZ" : "en-GB", { maximumFractionDigits: 2 });
  const money = (n: number) => formatCurrency(Math.round(n));
  return (
    <div className="rounded-xl bg-ink/[0.04] border border-ink/10 p-3 space-y-3 text-[12px]">
      {option.rentals.map(({ plan, segment }, i) => {
        const b = planBreakdown(plan, segment.minutes, segment.km, segment.start);
        const lines: [string, string, string][] = [];
        if (b.kind === "bands") {
          lines.push([t.breakdownBandsTime, "", money(b.time)]);
          lines.push([t.breakdownKm, t.breakdownBandsKm(number(Math.round(b.km * 10) / 10)), money(b.kmCost)]);
        } else {
          const isPackage = plan.packageMinutes != null;
          if (isPackage) {
            lines.push([t.breakdownPackage(plan.name), t.breakdownIncluded(formatDurationShort(plan.packageMinutes!), plan.packageKm), money(b.packagePrice)]);
          }
          if (b.extraMinutes > 0 && !Number.isFinite(b.timeCost)) {
            lines.push([t.breakdownExtraTime, t.breakdownCantRunOver, "—"]);
          } else if (b.nightMinutes > 0) {
            lines.push([t.breakdownExtraTimeDay, t.breakdownMinutes(b.dayMinutes, number(b.minuteRate)), money(b.dayMinutes * b.minuteRate)]);
            lines.push([t.breakdownExtraTimeNight, t.breakdownMinutes(b.nightMinutes, number(b.nightMinuteRate)), money(b.nightMinutes * b.nightMinuteRate)]);
          } else if (b.extraMinutes > 0 || !isPackage) {
            lines.push([isPackage ? t.breakdownExtraTime : t.breakdownTime, t.breakdownMinutes(b.extraMinutes, number(b.minuteRate)), money(b.timeCost)]);
          }
          lines.push([
            isPackage ? t.breakdownExtraKm : t.breakdownKm,
            b.extraKm > 0 ? t.breakdownKmRate(number(Math.round(b.extraKm * 10) / 10), number(b.kmRate)) : t.breakdownWithinPackage,
            money(b.kmCost),
          ]);
        }
        return (
          <div key={i}>
            {option.rentals.length > 1 && (
              <div className="label !text-[10px] mb-1">{t.breakdownRental(i + 1, formatDurationShort(segment.minutes), number(Math.round(segment.km * 10) / 10))}</div>
            )}
            <dl className="space-y-1">
              {lines.map(([label, detail, amount]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="min-w-0">
                    {label}
                    {detail && <span className="placeholder-text"> · {detail}</span>}
                  </dt>
                  <dd className="tabular-nums whitespace-nowrap">{amount}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t border-ink/10 pt-1 font-semibold">
                <dt>{t.breakdownTotal}</dt>
                <dd className="tabular-nums whitespace-nowrap">{money(b.total)}</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownToggle({ id, expanded, onToggle, label }: { id: string; expanded: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={id}
      className="text-[11px] placeholder-text hover:text-accent inline-flex items-center gap-1 mt-0.5"
    >
      {label}
      <span aria-hidden className={`inline-block transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}>
        ▾
      </span>
    </button>
  );
}

/** Fuel, amortization and any other running cost of an own car, each with how it's worked out. */
function CarBreakdown({ car, km, t, locale }: { car: VehicleInput; km: number; t: T; locale: Locale }) {
  const number = (n: number) => n.toLocaleString(locale === "cs" ? "cs-CZ" : "en-GB", { maximumFractionDigits: 2 });
  const money = (n: number) => formatCurrency(Math.round(n));
  const cost = vehicleCost(car, km);
  const distance = number(Math.round(km * 10) / 10);
  const lines: [string, string, string][] = [
    [t.breakdownFuel, t.breakdownFuelDetail(number(Math.round(cost.litres * 10) / 10), number(car.fuelPricePerLitre)), money(cost.fuel)],
    [t.breakdownAmortization, t.breakdownKmRate(distance, number(car.amortizationPerKm)), money(cost.amortization)],
  ];
  if (car.extraCostPerKm > 0) lines.push([t.breakdownOtherCost, t.breakdownKmRate(distance, number(car.extraCostPerKm)), money(cost.other)]);
  return (
    <div className="rounded-xl bg-ink/[0.04] border border-ink/10 p-3 text-[12px]">
      <dl className="space-y-1">
        {lines.map(([label, detail, amount]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0">
              {label}
              <span className="placeholder-text"> · {detail}</span>
            </dt>
            <dd className="tabular-nums whitespace-nowrap">{amount}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-ink/10 pt-1 font-semibold">
          <dt>{t.breakdownTotal}</dt>
          <dd className="tabular-nums whitespace-nowrap">{money(cost.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
