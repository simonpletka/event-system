"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createQuoteAction, updateQuoteAction, type FinanceFormState } from "@/lib/actions/finance";
import { toDateTimeLocal, formatDate } from "@/lib/format";
import { LineItemsFields, BLANK_ITEM, type LineItem } from "./LineItemsFields";
import { EventPicker } from "@/components/EventPicker";
import { CancelLink } from "@/components/ui/CancelLink";
import type { QuoteStatus, Currency } from "@/generated/prisma/enums";

const initialState: FinanceFormState = {};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isoDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function QuoteForm({
  events,
  categories,
  defaults,
  initialEventId,
}: {
  events: { id: string; title: string; companyName: string; startDate: Date }[];
  categories: string[];
  defaults?: {
    id: string;
    eventId: string;
    status: QuoteStatus;
    currency: Currency;
    validUntil: Date;
    hideItemPrices: boolean;
    items: LineItem[];
  };
  /** Pre-selects the event when arriving via an event's own "New quote" shortcut. */
  initialEventId?: string;
}) {
  const isEdit = Boolean(defaults);
  const action = isEdit ? updateQuoteAction : createQuoteAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [eventId, setEventId] = useState(defaults?.eventId ?? initialEventId ?? "");
  const [currency, setCurrency] = useState<Currency>(defaults?.currency ?? "CZK");
  const [items, setItems] = useState<LineItem[]>(defaults?.items.length ? defaults.items : [{ ...BLANK_ITEM }]);
  const [hideItemPrices, setHideItemPrices] = useState(defaults?.hideItemPrices ?? true);
  const [validUntil, setValidUntil] = useState(
    defaults ? toDateTimeLocal(defaults.validUntil).slice(0, 10) : isoDateInput(new Date(new Date().getTime() + TWO_WEEKS_MS))
  );

  const conflict = useMemo(() => {
    const event = events.find((e) => e.id === eventId);
    if (!event || !validUntil) return null;
    const validUntilDate = new Date(validUntil);
    const diffMs = event.startDate.getTime() - validUntilDate.getTime();
    if (Math.abs(diffMs) < WEEK_MS) return event.startDate;
    return null;
  }, [eventId, validUntil, events]);

  return (
    <form action={formAction} className="max-w-3xl flex flex-col gap-4">
      {isEdit && <input type="hidden" name="id" value={defaults!.id} />}

      {!isEdit && (
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Event</span>
          <EventPicker name="eventId" initialEvents={events} defaultValue={initialEventId} required onSelect={setEventId} />
        </label>
      )}

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Status</span>
          <select name="status" defaultValue={defaults?.status ?? "DRAFT"} className="input">
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DECLINED">Rejected</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Currency</span>
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="input">
            <option value="CZK">CZK — Czech koruna</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — US dollar</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">Valid until</span>
          <input
            name="validUntil"
            type="date"
            required
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={`input ${conflict ? "!border-accent text-accent" : ""}`}
          />
          {conflict && (
            <span className="text-[9px] text-accent">
              Event starts {formatDate(conflict, { day: "numeric", month: "short", year: "numeric" })} — too close to
              this validity date.
            </span>
          )}
        </label>
      </div>

      <LineItemsFields items={items} onChange={setItems} currency={currency} categories={categories} />

      <label className="flex items-center gap-1.5 text-[11px]">
        <input
          type="checkbox"
          name="hideItemPrices"
          checked={hideItemPrices}
          onChange={(e) => setHideItemPrices(e.target.checked)}
        />
        Hide individual item prices on the PDF — show only each category&apos;s subtotal and the grand total
      </label>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create quote"}
        </button>
        <CancelLink href="/finance/quotes" />
      </div>
    </form>
  );
}
