"use client";

import { useActionState, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/dictionary";
import { DEFAULT_RATE_PERCENT, effectiveDayRate, paybackDays } from "@/lib/gear-pricing";
import { createGearTypeAction, updateGearTypeAction, type GearFormState } from "@/lib/actions/gear";
import { gearError } from "./CategoryManager";
import { PillSwitch } from "./shared";

export const GEAR_TYPE_FORM_ID = "gear-type-form";

export type GearTypeValues = {
  id: string;
  name: string;
  categoryId: string;
  notes: string;
  purchasePrice: number;
  rateMode: "AUTO" | "CUSTOM";
  ratePercent: number;
  customDayRate: number | null;
};

/** Reads "52 900" or "52900 Kč" as 52900 for the live rate; the server parses it the same way. */
function parsePrice(text: string) {
  const n = Number(text.replace(/[\s ]|Kč|CZK/gi, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/**
 * Details and pricing of one gear type, for both New gear and the item page.
 * The day rate is worked out live from the same helper the server uses.
 * `left`/`right` add cards under each column (units, groups) on the item page;
 * those hold only plain buttons, never forms, so nothing nests.
 */
export function GearTypeForm({
  mode,
  values,
  categories,
  canManage,
  locale,
  left,
  right,
}: {
  mode: "new" | "edit";
  values: GearTypeValues;
  categories: { id: string; name: string }[];
  canManage: boolean;
  locale: Locale;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const t = getDictionary(locale).gear;
  const [state, action, pending] = useActionState<GearFormState, FormData>(mode === "new" ? createGearTypeAction : updateGearTypeAction, {});
  const [price, setPrice] = useState(values.purchasePrice ? String(values.purchasePrice) : "");
  const [rateMode, setRateMode] = useState(values.rateMode);
  const [percent, setPercent] = useState(String(values.ratePercent));
  const [custom, setCustom] = useState(values.customDayRate != null ? String(values.customDayRate) : "");

  const pricing = {
    purchasePrice: parsePrice(price),
    rateMode,
    ratePercent: Number(percent.replace(",", ".")) || 0,
    customDayRate: custom === "" ? null : parsePrice(custom),
  };
  const rate = effectiveDayRate(pricing);
  const payback = paybackDays(pricing);
  const disabled = !canManage;

  return (
    <form id={GEAR_TYPE_FORM_ID} action={action} className="flex flex-col lg:flex-row gap-4 md:gap-6 items-start">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="rateMode" value={rateMode} />

      <div className="flex-[1_1_440px] min-w-0 w-full flex flex-col gap-4 md:gap-6">
        <fieldset disabled={disabled} className="card p-5 md:p-6 flex flex-col gap-4">
          <legend className="sr-only">{t.details}</legend>
          <h2 className="text-[20px] font-bold">{t.details}</h2>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.name}</span>
            <input name="name" defaultValue={values.name} required className="input" />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1.5 flex-[1_1_180px]">
              <span className="field-label">{t.category}</span>
              <select name="categoryId" defaultValue={values.categoryId} required className="input">
                <option value="" disabled>
                  {t.chooseCategory}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {mode === "new" && (
              <label className="flex flex-col gap-1.5 flex-[1_1_120px]">
                <span className="field-label">{t.initialUnits}</span>
                <input name="units" type="number" min={0} max={100} defaultValue={1} required className="input" />
              </label>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.notes}</span>
            <textarea name="notes" rows={3} defaultValue={values.notes} className="input resize-none" />
          </label>
        </fieldset>
        {left}
      </div>

      <div className="flex-[1_1_380px] min-w-0 w-full flex flex-col gap-4 md:gap-6">
        <fieldset disabled={disabled} className="card p-5 md:p-6 flex flex-col gap-4">
          <legend className="sr-only">{t.pricing}</legend>
          <h2 className="text-[20px] font-bold">{t.pricing}</h2>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.boughtFor}</span>
            <input name="purchasePrice" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
          </label>
          <div className="flex flex-col gap-2">
            <span className="field-label">{t.dayRate}</span>
            {canManage ? (
              <PillSwitch
                label={t.dayRate}
                value={rateMode}
                onChange={setRateMode}
                options={[
                  { value: "AUTO", label: t.rateAuto(pricing.ratePercent) },
                  { value: "CUSTOM", label: t.rateCustom },
                ]}
              />
            ) : (
              <span className="text-[14px]">{rateMode === "AUTO" ? t.rateAuto(pricing.ratePercent) : t.rateCustom}</span>
            )}
          </div>
          {rateMode === "AUTO" ? (
            <label className="flex flex-col gap-1.5">
              <span className="field-label">{t.ratePercent}</span>
              <input name="ratePercent" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder={String(DEFAULT_RATE_PERCENT)} className="input" />
            </label>
          ) : (
            <>
              <input type="hidden" name="ratePercent" value={percent} />
              <label className="flex flex-col gap-1.5">
                <span className="field-label">{t.customRate}</span>
                <input name="customDayRate" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} required className="input" />
              </label>
            </>
          )}
          {rateMode === "AUTO" && <input type="hidden" name="customDayRate" value={custom} />}
          <div className="flex justify-between items-baseline gap-3 p-4 rounded-2xl bg-ink/5">
            <span className="text-[13.5px] placeholder-text">{t.ratePerDay}</span>
            <span className="text-[26px] font-bold tabular-nums">{formatCurrency(rate)}</span>
          </div>
          <p className="text-[12.5px] leading-relaxed placeholder-text">
            {payback ? t.payback(payback) : t.paybackNever} {rateMode === "AUTO" && t.customHint}
          </p>
        </fieldset>
        {right}
      </div>

      {canManage && (
        <div className="w-full lg:hidden">
          <button type="submit" disabled={pending} className="btn w-full min-h-[44px]">
            {mode === "new" ? t.createGear : t.saveChanges}
          </button>
        </div>
      )}
      {(state.error || state.ok) && (
        <p role={state.error ? "alert" : "status"} className={`w-full text-[13px] ${state.error ? "text-warning" : "text-positive"} lg:order-first`}>
          {state.error ? gearError(t, state.error) : t.saved}
        </p>
      )}
    </form>
  );
}
