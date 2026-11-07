"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteCarsharingPlanAction,
  deleteVehicleAction,
  saveCarsharingPlanAction,
  saveVehicleAction,
  type TravelFormState,
} from "@/lib/actions/trips";
import { DEFAULT_FUEL_PRICE, DEFAULT_VEHICLE } from "@/lib/carsharing-defaults";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { formatCurrency } from "@/lib/format";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

type T = Dictionary["settings"]["travel"];
const EMPTY: TravelFormState = {};

export type VehicleRow = {
  id: string;
  name: string;
  fuelType: "PETROL" | "DIESEL";
  consumptionPer100Km: number;
  fuelPricePerLitre: number;
  extraCostPerKm: number;
};

export type PlanRow = {
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
  active: boolean;
};

export function TravelTab({
  vehicles,
  plans,
  canEditPlans,
  locale,
}: {
  vehicles: VehicleRow[];
  plans: PlanRow[];
  canEditPlans: boolean;
  locale: Locale;
}) {
  const t = getDictionary(locale).settings.travel;
  return (
    <div className="space-y-6">
      <div>
        <div className="heading-label !text-[12px] mb-2">{t.carsHeading}</div>
        <p className="text-[11px] placeholder-text mb-3 max-w-prose">{t.carsHelp}</p>
        <div className="card p-3.5 space-y-2">
          {vehicles.map((v) => (
            <VehicleItem key={v.id} vehicle={v} t={t} />
          ))}
          <VehicleForm t={t} addLabel={vehicles.length === 0 ? t.addOctavia : t.addCar} prefill={vehicles.length === 0} />
        </div>
      </div>
      {canEditPlans && (
        <div>
          <div className="heading-label !text-[12px] mb-2">{t.plansHeading}</div>
          <p className="text-[11px] placeholder-text mb-3 max-w-prose">{t.plansHelp}</p>
          <div className="card p-3.5 space-y-2">
            {plans.map((p) => (
              <PlanItem key={p.id} plan={p} t={t} />
            ))}
            <PlanForm t={t} />
          </div>
        </div>
      )}
    </div>
  );
}

function VehicleItem({ vehicle, t }: { vehicle: VehicleRow; t: T }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <VehicleFields vehicle={vehicle} t={t} onDone={() => setEditing(false)} />;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/13 pb-2 text-[13px]">
      <div>
        {vehicle.name}
        <div className="text-[11px] placeholder-text">
          {t.fuel[vehicle.fuelType]} · {vehicle.consumptionPer100Km} l/100 km · {vehicle.fuelPricePerLitre} Kč/l
        </div>
      </div>
      <div className="flex gap-1.5">
        <button type="button" className="btno" onClick={() => setEditing(true)}>
          {t.edit}
        </button>
        <ConfirmDeleteButton action={deleteVehicleAction} fields={{ id: vehicle.id }} confirmMessage={t.confirmDeleteCar(vehicle.name)} label={t.delete} />
      </div>
    </div>
  );
}

function VehicleForm({ t, addLabel, prefill }: { t: T; addLabel: string; prefill: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btno" onClick={() => setOpen(true)}>
        {addLabel}
      </button>
    );
  }
  return (
    <VehicleFields
      vehicle={
        prefill
          ? { ...DEFAULT_VEHICLE, id: "" }
          : { id: "", name: "", fuelType: "DIESEL", consumptionPer100Km: 0, fuelPricePerLitre: DEFAULT_FUEL_PRICE.DIESEL, extraCostPerKm: 0 }
      }
      t={t}
      onDone={() => setOpen(false)}
    />
  );
}

function VehicleFields({ vehicle, t, onDone }: { vehicle: VehicleRow; t: T; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveVehicleAction, EMPTY);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone unmounts this form, it can't re-fire.
  }, [state]);

  return (
    <form action={formAction} className="space-y-2 border-b border-ink/13 pb-3">
      <input type="hidden" name="id" value={vehicle.id} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <label className="block col-span-2 md:col-span-1">
          <span className="label">{t.carName}</span>
          <input name="name" defaultValue={vehicle.name} className="input w-full" required />
        </label>
        <label className="block">
          <span className="label">{t.fuelType}</span>
          <select name="fuelType" defaultValue={vehicle.fuelType} className="input w-full">
            <option value="DIESEL">{t.fuel.DIESEL}</option>
            <option value="PETROL">{t.fuel.PETROL}</option>
          </select>
        </label>
        <label className="block">
          <span className="label">{t.consumption}</span>
          <input name="consumptionPer100Km" inputMode="decimal" defaultValue={vehicle.consumptionPer100Km || ""} className="input w-full" required />
        </label>
        <label className="block">
          <span className="label">{t.fuelPrice}</span>
          <input name="fuelPricePerLitre" inputMode="decimal" defaultValue={vehicle.fuelPricePerLitre} className="input w-full" required />
        </label>
        <label className="block">
          <span className="label">{t.extraCost}</span>
          <input name="extraCostPerKm" inputMode="decimal" defaultValue={vehicle.extraCostPerKm} className="input w-full" />
        </label>
      </div>
      {state.error && <p className="text-[12px] text-warning">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn" disabled={pending}>
          {t.save}
        </button>
        <button type="button" className="btno" onClick={onDone}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function PlanItem({ plan, t }: { plan: PlanRow; t: T }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <PlanFields plan={plan} t={t} onDone={() => setEditing(false)} />;
  const isPackage = plan.packagePrice > 0;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/13 pb-2 text-[13px]">
      <div className={plan.active ? "" : "opacity-50"}>
        {plan.provider} · {plan.name}
        {plan.carClass && <span className="placeholder-text"> · {plan.carClass}</span>}
        <div className="text-[11px] placeholder-text">
          {plan.bandsJson
            ? t.bandsSummary
            : `${isPackage ? `${formatCurrency(plan.packagePrice)} · ${plan.packageKm} km · ` : ""}${plan.minuteRate} Kč/min · ${plan.kmRate} Kč/km`}
          {!plan.verified && ` · ${t.unverified}`}
          {!plan.active && ` · ${t.inactive}`}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button type="button" className="btno" onClick={() => setEditing(true)}>
          {t.edit}
        </button>
        <ConfirmDeleteButton action={deleteCarsharingPlanAction} fields={{ id: plan.id }} confirmMessage={t.confirmDeletePlan(plan.name)} label={t.delete} />
      </div>
    </div>
  );
}

function PlanForm({ t }: { t: T }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btno" onClick={() => setOpen(true)}>
        {t.addPlan}
      </button>
    );
  }
  return (
    <PlanFields
      plan={{
        id: "",
        provider: "",
        name: "",
        carClass: "",
        packagePrice: 0,
        packageMinutes: null,
        packageKm: 0,
        minuteRate: 0,
        kmRate: 0,
        bandsJson: null,
        weekendOnly: false,
        verified: true,
        active: true,
      }}
      t={t}
      onDone={() => setOpen(false)}
    />
  );
}

function PlanFields({ plan, t, onDone }: { plan: PlanRow; t: T; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(saveCarsharingPlanAction, EMPTY);
  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone unmounts this form, it can't re-fire.
  }, [state]);

  const number = (name: string, label: string, value: number | string | null) => (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} inputMode="decimal" defaultValue={value ?? ""} className="input w-full" />
    </label>
  );
  const check = (name: string, label: string, value: boolean) => (
    <label className="flex items-center gap-1.5 text-[12px]">
      <input type="checkbox" name={name} defaultChecked={value} />
      {label}
    </label>
  );

  return (
    <form action={formAction} className="space-y-2 border-b border-ink/13 pb-3">
      <input type="hidden" name="id" value={plan.id} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <label className="block">
          <span className="label">{t.provider}</span>
          <input name="provider" defaultValue={plan.provider} className="input w-full" required />
        </label>
        <label className="block">
          <span className="label">{t.planName}</span>
          <input name="name" defaultValue={plan.name} className="input w-full" required />
        </label>
        <label className="block">
          <span className="label">{t.carClass}</span>
          <input name="carClass" defaultValue={plan.carClass} className="input w-full" />
        </label>
        {plan.bandsJson ? (
          <p className="text-[11px] placeholder-text col-span-2 md:col-span-3">{t.bandsReadOnly}</p>
        ) : (
          <>
            {number("packagePrice", t.packagePrice, plan.packagePrice)}
            {number("packageHours", t.packageHours, plan.packageMinutes == null ? null : plan.packageMinutes / 60)}
            {number("packageKm", t.packageKm, plan.packageKm)}
            {number("minuteRate", t.minuteRate, plan.minuteRate)}
            {number("kmRate", t.kmRate, plan.kmRate)}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {check("weekendOnly", t.weekendOnly, plan.weekendOnly)}
        {check("verified", t.verified, plan.verified)}
        {check("active", t.active, plan.active)}
      </div>
      {state.error && <p className="text-[12px] text-warning">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn" disabled={pending}>
          {t.save}
        </button>
        <button type="button" className="btno" onClick={onDone}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
