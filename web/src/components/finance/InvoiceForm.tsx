"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createInvoiceAction, type FinanceFormState } from "@/lib/actions/finance";
import { LineItemsFields, BLANK_ITEM, type LineItem } from "./LineItemsFields";
import { EventPicker, type PickableEvent } from "@/components/EventPicker";
import { CancelLink } from "@/components/ui/CancelLink";
import type { Currency, DiscountType } from "@/generated/prisma/enums";
import { getDictionary, type Locale } from "@/lib/dictionary";

const initialState: FinanceFormState = {};

export function InvoiceForm({
  events,
  categories,
  defaultDueDate,
  locale,
}: {
  events: PickableEvent[];
  categories: string[];
  defaultDueDate: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const [state, formAction, pending] = useActionState(createInvoiceAction, initialState);
  const [currency, setCurrency] = useState<Currency>("CZK");
  const [items, setItems] = useState<LineItem[]>([{ ...BLANK_ITEM }]);
  const [hideItemPrices, setHideItemPrices] = useState(true);
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState(0);
  const [autoFilled, setAutoFilled] = useState(false);
  const tf = t.finance.invoiceForm;
  const tl = t.finance.lineItems;

  // Picking an event auto-fills a single line item from its name + quoted
  // value — a real time-saver for the common "one line item per event"
  // invoice, and just as easily edited/cleared afterward. Only kicks in
  // once, and only while the items list is still untouched from the blank
  // default, so it never clobbers something the user already typed.
  function handleEventSelect(eventId: string) {
    if (autoFilled) return;
    const isUntouched = items.length === 1 && !items[0].description && items[0].unitPrice === 0;
    if (!isUntouched) return;
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    setItems([{ ...BLANK_ITEM, description: event.title, unitPrice: event.quotedValue ?? 0 }]);
    setAutoFilled(true);
  }

  return (
    <form action={formAction} className="max-w-3xl flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="heading-label">{tf.eventLabel}</span>
        <EventPicker name="eventId" initialEvents={events} required onSelect={handleEventSelect} t={t.events.picker} />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xs">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{tf.dueDateLabel}</span>
          <input name="dueDate" type="date" required defaultValue={defaultDueDate} className="input" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{tf.currencyLabel}</span>
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="input">
            <option value="CZK">CZK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-md">
        <label className="flex flex-col gap-1.5">
          <span className="heading-label">{tf.discountLabel}</span>
          <select
            name="discountType"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
            className="input"
          >
            <option value="NONE">{tf.discountNone}</option>
            <option value="PERCENT">{tf.discountPercent}</option>
            <option value="FIXED">{tf.discountFixed}</option>
          </select>
        </label>
        {discountType !== "NONE" && (
          <label className="flex flex-col gap-1.5">
            <span className="heading-label">{discountType === "PERCENT" ? tf.percentLabel : tf.amountLabel(currency)}</span>
            <input
              name="discountValue"
              type="number"
              min={0}
              max={discountType === "PERCENT" ? 100 : undefined}
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className="input"
            />
          </label>
        )}
      </div>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? tf.creating : tf.createInvoice}
        </button>
        <CancelLink href="/finance/invoices" label={t.common.cancel} />
      </div>
    </form>
  );
}
