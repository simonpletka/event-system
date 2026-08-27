"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createQuoteAction, updateQuoteAction, type FinanceFormState } from "@/lib/actions/finance";
import { toDateTimeLocal, formatDate } from "@/lib/format";
import { LineItemsFields, BLANK_ITEM, type LineItem } from "./LineItemsFields";
import { EventPicker } from "@/components/EventPicker";
import { CancelLink } from "@/components/ui/CancelLink";
import type { QuoteStatus, Currency } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";

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
  locale,
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
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const isEdit = Boolean(defaults);
  const action = isEdit ? updateQuoteAction : createQuoteAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const tf = t.finance.quoteForm;
  const tl = t.finance.lineItems;

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
          <span className="field-label">{tf.eventLabel}</span>
          <EventPicker name="eventId" initialEvents={events} defaultValue={initialEventId} required onSelect={setEventId} t={t.events.picker} />
        </label>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{tf.statusLabel}</span>
          <select name="status" defaultValue={defaults?.status ?? "DRAFT"} className="input">
            <option value="DRAFT">{tf.statusDraft}</option>
            <option value="SENT">{tf.statusSent}</option>
            <option value="ACCEPTED">{tf.statusAccepted}</option>
            <option value="DECLINED">{tf.statusRejected}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{tf.currencyLabel}</span>
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="input">
            <option value="CZK">{tf.czk}</option>
            <option value="EUR">{tf.eur}</option>
            <option value="USD">{tf.usd}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{tf.validUntilLabel}</span>
          <input
            name="validUntil"
            type="date"
            required
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={`input ${conflict ? "!border-warning text-warning" : ""}`}
          />
          {conflict && (
            <span className="text-[9px] text-warning">
              {tf.eventTooCloseWarning(formatDate(conflict, { day: "numeric", month: "short", year: "numeric" }))}
            </span>
          )}
        </label>
      </div>

      <LineItemsFields items={items} onChange={setItems} currency={currency} categories={categories} t={tl} />

      <label className="flex items-center gap-1.5 text-[11px]">
        <input
          type="checkbox"
          name="hideItemPrices"
          checked={hideItemPrices}
          onChange={(e) => setHideItemPrices(e.target.checked)}
        />
        {tf.hideItemPricesLabel}
      </label>

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? tf.saving : isEdit ? tf.saveChanges : tf.createQuote}
        </button>
        <CancelLink href="/finance/quotes" label={t.common.cancel} />
      </div>
    </form>
  );
}
