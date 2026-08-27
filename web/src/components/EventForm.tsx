"use client";

import { useActionState, useState } from "react";
import { createEventAction, updateEventAction, type EventFormState } from "@/lib/actions/events";
import { toDateTimeLocal, formatClientAddress } from "@/lib/format";
import { CancelLink } from "@/components/ui/CancelLink";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { ClientPicker, type PickableClient } from "@/components/ClientPicker";
import { useAresLookup } from "@/hooks/useAresLookup";
import type { EventStatus } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";

const STATUS_KEYS: EventStatus[] = ["INQUIRY", "QUOTE_SENT", "CONFIRMED", "IN_PROGRESS", "TO_INVOICE", "CLOSED", "CANCELLED"];

type VenueRow = { name: string; address: string; note: string };
type ContactRow = { name: string; phone: string; email: string };

export type EventFormDefaults = {
  id?: string;
  title: string;
  brief: string;
  clientId: string | null;
  contacts: ContactRow[];
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

export function EventForm({ defaults, clients, locale }: { defaults: EventFormDefaults; clients: PickableClient[]; locale: Locale }) {
  const t = getDictionary(locale);
  const isEdit = Boolean(defaults.id);
  const action = isEdit ? updateEventAction : createEventAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [venues, setVenues] = useState<VenueRow[]>(defaults.venues.length ? defaults.venues : [{ name: "", address: "", note: "" }]);
  const [contacts, setContacts] = useState<ContactRow[]>(
    defaults.contacts.length ? defaults.contacts : [{ name: "", phone: "", email: "" }]
  );

  const [companyIco, setCompanyIco] = useState(defaults.companyIco);
  const [companyName, setCompanyName] = useState(defaults.companyName);
  const [companyAddress, setCompanyAddress] = useState(defaults.companyAddress);
  const [companyDic, setCompanyDic] = useState(defaults.companyDic);
  const ares = useAresLookup();

  const [startDate, setStartDate] = useState(toDateTimeLocal(defaults.startDate));
  const [endDate, setEndDate] = useState(toDateTimeLocal(defaults.endDate));

  const tf = t.events.form;

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

      <Field label={tf.titleLabel}>
        <input name="title" defaultValue={defaults.title} required className="input" />
      </Field>

      <Field label={tf.briefLabel}>
        <textarea name="brief" defaultValue={defaults.brief} rows={3} className="input" />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={tf.statusLabel}>
          <select name="status" defaultValue={defaults.status} className="input">
            {STATUS_KEYS.map((s) => (
              <option key={s} value={s}>
                {t.statusEvent[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tf.quotedValueLabel}>
          <input name="quotedValue" type="number" min={0} defaultValue={defaults.quotedValue} className="input" />
        </Field>
      </div>

      <div className="heading-label !text-[12px]">{tf.datesHeading}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={tf.buildPrepLabel}>
          <input name="buildDate" type="datetime-local" defaultValue={toDateTimeLocal(defaults.buildDate)} className="input" />
        </Field>
        <Field label={tf.strikeLabel}>
          <input name="strikeDate" type="datetime-local" defaultValue={toDateTimeLocal(defaults.strikeDate)} className="input" />
        </Field>
        <Field label={tf.eventStartLabel}>
          <input
            name="startDate"
            type="datetime-local"
            required
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            className="input"
          />
        </Field>
        <Field label={tf.eventEndLabel}>
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
        <div className="heading-label !text-[12px] mb-1.5">{tf.venuesHeading}</div>
        <div className="flex flex-col gap-2">
          {venues.map((v, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
              <input
                name="venueName"
                placeholder={tf.venueName}
                defaultValue={v.name}
                className="input"
              />
              <input name="venueAddress" placeholder={tf.venueAddress} defaultValue={v.address} className="input" />
              <input name="venueNote" placeholder={tf.venueNote} defaultValue={v.note} className="input" />
              {venues.length > 1 && (
                <button
                  type="button"
                  onClick={() => setVenues((vs) => vs.filter((_, idx) => idx !== i))}
                  className="btno px-2 py-2 text-[9px]"
                >
                  {tf.remove}
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setVenues((vs) => [...vs, { name: "", address: "", note: "" }])}
          className="btno mt-2 text-[9px]"
        >
          {tf.addVenue}
        </button>
      </div>

      <div className="heading-label !text-[12px]">{tf.clientHeading}</div>
      <Field label={tf.linkedClientLabel}>
        <ClientPicker
          initialClients={clients}
          defaultValue={defaults.clientId ?? ""}
          newClientOptionLabel={tf.newClientOption}
          onSelect={(client) => {
            if (!client) return;
            setCompanyName(client.name);
            setCompanyAddress(
              formatClientAddress({ street: client.street ?? "", city: client.city ?? "", postCode: client.postCode ?? "", state: client.state ?? "" })
            );
            setCompanyIco(client.ico ?? "");
            setCompanyDic(client.dic ?? "");
          }}
        />
      </Field>
      <div>
        <div className="heading-label !text-[12px] mb-1.5">{tf.contactPeopleHeading}</div>
        <p className="text-[10px] placeholder-text mb-2">{tf.contactNote}</p>
        <div className="flex flex-col gap-2">
          {contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
              <input
                name="contactName"
                placeholder={tf.contactName}
                defaultValue={c.name}
                required
                className="input"
              />
              <input name="contactPhone" placeholder={tf.contactPhone} defaultValue={c.phone} className="input" />
              <input name="contactEmail" placeholder={tf.contactEmail} type="email" defaultValue={c.email} className="input" />
              {contacts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setContacts((cs) => cs.filter((_, idx) => idx !== i))}
                  className="btno px-2 py-2 text-[9px]"
                >
                  {tf.remove}
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setContacts((cs) => [...cs, { name: "", phone: "", email: "" }])}
          className="btno mt-2 text-[9px]"
        >
          {tf.addContact}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={tf.icoLabel}>
          <div className="flex gap-1.5">
            <input
              name="companyIco"
              value={companyIco}
              onChange={(e) => setCompanyIco(e.target.value)}
              className="input flex-1"
            />
            <button type="button" onClick={loadFromAres} disabled={ares.loading} className="btno text-[9px] whitespace-nowrap">
              {ares.loading ? tf.loadingAres : tf.loadFromAres}
            </button>
          </div>
        </Field>
        <Field label={tf.dicLabel}>
          <input name="companyDic" value={companyDic} onChange={(e) => setCompanyDic(e.target.value)} className="input" />
        </Field>
        <Field label={tf.companyNameLabel}>
          <input
            name="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="input"
          />
        </Field>
        <Field label={tf.companyAddressLabel}>
          <AddressAutocompleteInput name="companyAddress" value={companyAddress} onChange={setCompanyAddress} searchingLabel={t.addressInput.searching} />
        </Field>
      </div>
      {ares.error && <p className="text-[11px] text-warning -mt-3">{ares.error}</p>}
      <p className="text-[10px] placeholder-text -mt-3">{tf.icoHelper}</p>

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? tf.saving : isEdit ? tf.saveChanges : tf.createEvent}
        </button>
        <CancelLink href={isEdit ? `/events/${defaults.id}` : "/events"} label={t.common.cancel} />
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
