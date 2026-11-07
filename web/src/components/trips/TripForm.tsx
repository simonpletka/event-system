"use client";

import { useActionState, useState } from "react";
import { saveTripAction, type TripFormState } from "@/lib/actions/trips";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { CancelLink } from "@/components/ui/CancelLink";
import { getDictionary, type Locale } from "@/lib/dictionary";

export type TripStopValues = {
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  arrive: string;
  depart: string;
  stay: string;
  manual: string;
  splitRental: boolean;
  note: string;
};

export type TripFormValues = {
  id: string;
  title: string;
  date: string;
  bufferMinutes: number;
  stops: TripStopValues[];
};

const EMPTY: TripFormState = {};
const BLANK_STOP: TripStopValues = { label: "", address: "", lat: null, lng: null, arrive: "", depart: "", stay: "", manual: "", splitRental: false, note: "" };

export function TripForm({
  projectId,
  values,
  cancelHref,
  locale,
}: {
  projectId: string;
  values: TripFormValues;
  cancelHref: string;
  locale: Locale;
}) {
  const t = getDictionary(locale).projects.trips;
  const [state, formAction, pending] = useActionState(saveTripAction, EMPTY);
  const [stops, setStops] = useState(values.stops);

  const update = (i: number, patch: Partial<TripStopValues>) =>
    setStops((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, by: number) =>
    setStops((prev) => {
      const next = [...prev];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="tripId" value={values.id} />
      <input type="hidden" name="stops" value={JSON.stringify(stops)} />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_170px_150px] gap-3">
        <label className="block">
          <span className="label">{t.title}</span>
          <input name="title" defaultValue={values.title} placeholder={t.titlePlaceholder} className="input w-full" required />
        </label>
        <label className="block">
          <span className="label">{t.date}</span>
          <input type="date" name="date" defaultValue={values.date} className="input w-full" required />
        </label>
        <label className="block">
          <span className="label">{t.buffer}</span>
          <input type="number" min={0} name="bufferMinutes" defaultValue={values.bufferMinutes} className="input w-full" />
        </label>
      </div>

      <div className="space-y-3">
        {stops.map((stop, i) => (
          <div key={i} className="card p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="heading-label">{t.stopNumber(i + 1)}</span>
              <div className="flex gap-1">
                <button type="button" className="btno" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t.moveUp}>
                  ↑
                </button>
                <button type="button" className="btno" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label={t.moveDown}>
                  ↓
                </button>
                <button
                  type="button"
                  className="btno"
                  disabled={stops.length <= 2}
                  onClick={() => setStops((prev) => prev.filter((_, j) => j !== i))}
                >
                  {t.removeStop}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
              <label className="block">
                <span className="label">{t.stopLabel}</span>
                <input
                  value={stop.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder={t.stopLabelPlaceholder}
                  className="input w-full"
                />
              </label>
              <div>
                <span className="label">{t.address}</span>
                <AddressAutocompleteInput
                  value={stop.address}
                  onChange={(address) => update(i, { address, lat: null, lng: null })}
                  onSelect={(s) => update(i, { address: s.label, lat: s.lat, lng: s.lon })}
                  placeholder={t.addressPlaceholder}
                  searchingLabel={t.searching}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {i > 0 && (
                <label className="block">
                  <span className="label">{t.mustArrive}</span>
                  <input type="time" value={stop.arrive} onChange={(e) => update(i, { arrive: e.target.value })} className="input w-full" />
                </label>
              )}
              <label className="block">
                <span className="label">{t.wantLeave}</span>
                <input type="time" value={stop.depart} onChange={(e) => update(i, { depart: e.target.value })} className="input w-full" />
              </label>
              {i > 0 && (
                <label className="block">
                  <span className="label">{t.stay}</span>
                  <input
                    type="number"
                    min={0}
                    value={stop.stay}
                    onChange={(e) => update(i, { stay: e.target.value })}
                    className="input w-full"
                  />
                </label>
              )}
              {i > 0 && (
                <label className="block">
                  <span className="label">{t.manual}</span>
                  <input
                    type="number"
                    min={0}
                    value={stop.manual}
                    onChange={(e) => update(i, { manual: e.target.value })}
                    placeholder={t.manualPlaceholder}
                    className="input w-full"
                  />
                </label>
              )}
            </div>

            {i > 0 && i < stops.length - 1 && (
              <label className="flex items-center gap-1.5 text-[12px]">
                <input type="checkbox" checked={stop.splitRental} onChange={(e) => update(i, { splitRental: e.target.checked })} />
                {t.splitRental}
              </label>
            )}

            <label className="block">
              <span className="label">{t.note}</span>
              <input value={stop.note} onChange={(e) => update(i, { note: e.target.value })} className="input w-full" />
            </label>
          </div>
        ))}
      </div>

      <button type="button" className="btno" onClick={() => setStops((prev) => [...prev, BLANK_STOP])}>
        {t.addStop}
      </button>

      <p className="text-[11px] placeholder-text max-w-prose">{t.formHelp}</p>
      {state.error && <p className="text-[12px] text-warning">{state.error}</p>}

      <div className="flex gap-2 items-center">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? t.calculating : t.saveAndCalculate}
        </button>
        <CancelLink href={cancelHref} label={getDictionary(locale).common.cancel} />
      </div>
    </form>
  );
}
