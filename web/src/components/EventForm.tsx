"use client";

import { useActionState, useState } from "react";
import { createEventAction, updateEventAction, type EventFormState } from "@/lib/actions/events";
import { toDateTimeLocal } from "@/lib/format";
import type { EventStatus } from "@/generated/prisma/enums";

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: "INQUIRY", label: "Inquiry" },
  { value: "QUOTE_SENT", label: "Quote sent" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "TO_INVOICE", label: "To invoice" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

type VenueRow = { name: string; address: string; note: string };

export type EventFormDefaults = {
  id?: string;
  title: string;
  brief: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  companyName: string;
  companyAddress: string;
  companyIco: string;
  companyDic: string;
  status: EventStatus;
  buildDate: Date | null;
  startDate: Date;
  endDate: Date;
  strikeDate: Date | null;
  quotedValue: number;
  venues: VenueRow[];
};

const initialState: EventFormState = {};

export function EventForm({ defaults }: { defaults: EventFormDefaults }) {
  const isEdit = Boolean(defaults.id);
  const action = isEdit ? updateEventAction : createEventAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [venues, setVenues] = useState<VenueRow[]>(defaults.venues.length ? defaults.venues : [{ name: "", address: "", note: "" }]);

  return (
    <form action={formAction} className="max-w-2xl flex flex-col gap-5">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <Field label="Title">
        <input name="title" defaultValue={defaults.title} required className="input" />
      </Field>

      <Field label="Brief / description">
        <textarea name="brief" defaultValue={defaults.brief} rows={3} className="input" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select name="status" defaultValue={defaults.status} className="input">
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quoted value (CZK)">
          <input name="quotedValue" type="number" min={0} defaultValue={defaults.quotedValue} className="input" />
        </Field>
      </div>

      <div className="heading-label">Dates</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Build / prep">
          <input name="buildDate" type="datetime-local" defaultValue={toDateTimeLocal(defaults.buildDate)} className="input" />
        </Field>
        <Field label="Strike">
          <input name="strikeDate" type="datetime-local" defaultValue={toDateTimeLocal(defaults.strikeDate)} className="input" />
        </Field>
        <Field label="Event start">
          <input name="startDate" type="datetime-local" required defaultValue={toDateTimeLocal(defaults.startDate)} className="input" />
        </Field>
        <Field label="Event end">
          <input name="endDate" type="datetime-local" required defaultValue={toDateTimeLocal(defaults.endDate)} className="input" />
        </Field>
      </div>

      <div>
        <div className="heading-label mb-1.5">Venues</div>
        <div className="flex flex-col gap-2">
          {venues.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
              <input
                name="venueName"
                placeholder="Name"
                defaultValue={v.name}
                className="input"
              />
              <input name="venueAddress" placeholder="Address" defaultValue={v.address} className="input" />
              <input name="venueNote" placeholder="Note" defaultValue={v.note} className="input" />
              <button
                type="button"
                onClick={() => setVenues((vs) => vs.filter((_, idx) => idx !== i))}
                className="btno px-2 py-2 text-[9px]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setVenues((vs) => [...vs, { name: "", address: "", note: "" }])}
          className="btno mt-2 text-[9px]"
        >
          Add venue
        </button>
      </div>

      <div className="heading-label">Client</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact name">
          <input name="clientName" defaultValue={defaults.clientName} required className="input" />
        </Field>
        <Field label="Contact phone">
          <input name="clientPhone" defaultValue={defaults.clientPhone} className="input" />
        </Field>
        <Field label="Contact email">
          <input name="clientEmail" type="email" defaultValue={defaults.clientEmail} className="input" />
        </Field>
        <Field label="Company name">
          <input name="companyName" defaultValue={defaults.companyName} required className="input" />
        </Field>
        <Field label="Company address">
          <input name="companyAddress" defaultValue={defaults.companyAddress} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="IČO">
            <input name="companyIco" defaultValue={defaults.companyIco} className="input" />
          </Field>
          <Field label="DIČ">
            <input name="companyDic" defaultValue={defaults.companyDic} className="input" />
          </Field>
        </div>
      </div>
      <p className="text-[10px] placeholder-text -mt-3">ARES auto-fill by IČO lands in a later phase — enter company data manually for now.</p>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create event"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="heading-label">{label}</span>
      {children}
    </label>
  );
}
