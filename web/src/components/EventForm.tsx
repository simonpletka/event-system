"use client";

import { useActionState, useState } from "react";
import { createEventAction, updateEventAction, type EventFormState } from "@/lib/actions/events";
import { toDateTimeLocal } from "@/lib/format";
import { CancelLink } from "@/components/ui/CancelLink";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { ClientPicker, type PickableClient } from "@/components/ClientPicker";
import { useAresLookup } from "@/hooks/useAresLookup";
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
  clientId: string | null;
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

export function EventForm({ defaults, clients }: { defaults: EventFormDefaults; clients: PickableClient[] }) {
  const isEdit = Boolean(defaults.id);
  const action = isEdit ? updateEventAction : createEventAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [venues, setVenues] = useState<VenueRow[]>(defaults.venues.length ? defaults.venues : [{ name: "", address: "", note: "" }]);

  const [companyIco, setCompanyIco] = useState(defaults.companyIco);
  const [companyName, setCompanyName] = useState(defaults.companyName);
  const [companyAddress, setCompanyAddress] = useState(defaults.companyAddress);
  const [companyDic, setCompanyDic] = useState(defaults.companyDic);
  const ares = useAresLookup();

  const [startDate, setStartDate] = useState(toDateTimeLocal(defaults.startDate));
  const [endDate, setEndDate] = useState(toDateTimeLocal(defaults.endDate));

  // Moving the start date always pulls the end date onto the same day (a
  // multi-day span has to be re-picked deliberately, not left stale). If
  // the end's existing time-of-day still lands after the new start on that
  // day, keep it as-is; otherwise the event would run backwards, so fall
  // back to preserving the original duration instead (a 2h event stays 2h).
  function handleStartChange(value: string) {
    setStartDate(value);
    const newStart = new Date(value);
    if (Number.isNaN(newStart.getTime())) return;

    const oldStart = new Date(startDate);
    const oldEnd = new Date(endDate);
    const durationMs =
      !Number.isNaN(oldStart.getTime()) && !Number.isNaN(oldEnd.getTime()) && oldEnd.getTime() > oldStart.getTime()
        ? oldEnd.getTime() - oldStart.getTime()
        : 2 * 60 * 60 * 1000;

    const sameDayEnd = new Date(newStart);
    if (!Number.isNaN(oldEnd.getTime())) sameDayEnd.setHours(oldEnd.getHours(), oldEnd.getMinutes(), 0, 0);

    const finalEnd = sameDayEnd.getTime() > newStart.getTime() ? sameDayEnd : new Date(newStart.getTime() + durationMs);
    setEndDate(toDateTimeLocal(finalEnd));
  }

  async function loadFromAres() {
    const company = await ares.lookup(companyIco);
    if (!company) return;
    setCompanyName(company.name);
    setCompanyAddress(company.address);
    setCompanyDic(company.dic);
    setCompanyIco(company.ico);
  }

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
          <input
            name="startDate"
            type="datetime-local"
            required
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Event end">
          <input
            name="endDate"
            type="datetime-local"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
          />
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
      <Field label="Linked client (optional — powers the Clients section's event/revenue rollup)">
        <ClientPicker
          initialClients={clients}
          defaultValue={defaults.clientId ?? ""}
          onSelect={(client) => {
            if (!client) return;
            setCompanyName(client.name);
            setCompanyAddress(client.address ?? "");
            setCompanyIco(client.ico ?? "");
            setCompanyDic(client.dic ?? "");
          }}
        />
      </Field>
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
        <Field label="IČO">
          <div className="flex gap-1.5">
            <input
              name="companyIco"
              value={companyIco}
              onChange={(e) => setCompanyIco(e.target.value)}
              className="input flex-1"
            />
            <button type="button" onClick={loadFromAres} disabled={ares.loading} className="btno text-[9px] whitespace-nowrap">
              {ares.loading ? "Loading…" : "Load from ARES"}
            </button>
          </div>
        </Field>
        <Field label="DIČ">
          <input name="companyDic" value={companyDic} onChange={(e) => setCompanyDic(e.target.value)} className="input" />
        </Field>
        <Field label="Company name">
          <input
            name="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="input"
          />
        </Field>
        <Field label="Company address">
          <AddressAutocompleteInput name="companyAddress" value={companyAddress} onChange={setCompanyAddress} />
        </Field>
      </div>
      {ares.error && <p className="text-[11px] text-accent -mt-3">{ares.error}</p>}
      <p className="text-[10px] placeholder-text -mt-3">Enter the IČO and use &quot;Load from ARES&quot; to fill in the rest.</p>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create event"}
        </button>
        <CancelLink href={isEdit ? `/events/${defaults.id}` : "/events"} />
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
