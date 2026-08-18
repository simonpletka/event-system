"use client";

import { formatCurrency, type CurrencyCode } from "@/lib/format";

export type LineItem = { description: string; quantity: number; unitPrice: number; vatRate: number; category: string };

export const BLANK_ITEM: LineItem = { description: "", quantity: 1, unitPrice: 0, vatRate: 21, category: "" };

/**
 * Controlled by the parent form (QuoteForm/InvoiceForm) rather than owning
 * its own state — InvoiceForm needs to auto-fill a single item from the
 * selected event's title/quoted value, which isn't possible if the items
 * array is private state inside this component.
 */
export function LineItemsFields({
  items,
  onChange,
  currency = "CZK",
  categories,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currency?: CurrencyCode;
  categories: string[];
}) {
  const base = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);

  function update(i: number, patch: Partial<LineItem>) {
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <datalist id="line-item-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="grid grid-cols-[24px_1fr_110px_70px_110px_70px_auto] gap-2 mb-1.5">
        <span></span>
        <span className="heading-label">Description</span>
        <span className="heading-label">Category</span>
        <span className="heading-label">Qty</span>
        <span className="heading-label">Unit price</span>
        <span className="heading-label">VAT %</span>
        <span></span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[24px_1fr_110px_70px_110px_70px_auto] gap-2 items-center">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-[9px] leading-none disabled:opacity-20"
                title="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="text-[9px] leading-none disabled:opacity-20"
                title="Move down"
              >
                ▼
              </button>
            </div>
            <input
              name="itemDescription"
              value={item.description}
              onChange={(e) => update(i, { description: e.target.value })}
              className="input"
              required
            />
            <input
              name="itemCategory"
              list="line-item-categories"
              placeholder="—"
              value={item.category}
              onChange={(e) => update(i, { category: e.target.value })}
              className="input"
            />
            <input
              name="itemQuantity"
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => update(i, { quantity: Number(e.target.value) || 1 })}
              onFocus={(e) => e.target.select()}
              className="input"
            />
            <input
              name="itemUnitPrice"
              type="number"
              min={0}
              value={item.unitPrice}
              onChange={(e) => update(i, { unitPrice: Number(e.target.value) || 0 })}
              onFocus={(e) => e.target.select()}
              className="input"
            />
            <input
              name="itemVatRate"
              type="number"
              min={0}
              max={100}
              value={item.vatRate}
              onChange={(e) => update(i, { vatRate: Number(e.target.value) || 0 })}
              onFocus={(e) => e.target.select()}
              className="input"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="btno px-2 py-2 text-[9px]"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, { ...BLANK_ITEM }])} className="btno mt-2 text-[9px]">
        Add item
      </button>

      <div className="flex justify-end items-center gap-6 mt-3 text-[13px]">
        <div>
          <span className="heading-label mr-2">Base</span>
          {formatCurrency(base, currency)}
        </div>
        <div>
          <span className="heading-label mr-2">VAT</span>
          {formatCurrency(vat, currency)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="heading-label mr-1">To pay</span>
          <span className="font-semibold text-base">{formatCurrency(base + vat, currency)}</span>
          <span className="pill !border-accent text-accent">{currency}</span>
        </div>
      </div>
    </div>
  );
}
