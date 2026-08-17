"use client";

import { useState } from "react";
import { formatCurrency, type CurrencyCode } from "@/lib/format";

export type LineItem = { description: string; quantity: number; unitPrice: number; vatRate: number };

export function LineItemsFields({ initial, currency = "CZK" }: { initial: LineItem[]; currency?: CurrencyCode }) {
  const [items, setItems] = useState<LineItem[]>(
    initial.length ? initial : [{ description: "", quantity: 1, unitPrice: 0, vatRate: 21 }]
  );

  const base = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);

  function update(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  return (
    <div>
      <div className="grid grid-cols-[1fr_70px_110px_70px_auto] gap-2 mb-1.5">
        <span className="heading-label pl-2.5">Description</span>
        <span className="heading-label pl-2.5">Qty</span>
        <span className="heading-label pl-2.5">Unit price</span>
        <span className="heading-label pl-2.5">VAT %</span>
        <span></span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_110px_70px_auto] gap-2 items-center">
            <input
              name="itemDescription"
              value={item.description}
              onChange={(e) => update(i, { description: e.target.value })}
              className="input"
              required
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
              onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
              className="btno px-2 py-2 text-[9px]"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, vatRate: 21 }])}
        className="btno mt-2 text-[9px]"
      >
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
