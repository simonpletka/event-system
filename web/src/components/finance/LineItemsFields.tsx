"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

export type LineItem = { description: string; quantity: number; unitPrice: number; vatRate: number };

export function LineItemsFields({ initial }: { initial: LineItem[] }) {
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
        <span className="heading-label">Description</span>
        <span className="heading-label">Qty</span>
        <span className="heading-label">Unit price</span>
        <span className="heading-label">VAT %</span>
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
              className="input"
            />
            <input
              name="itemUnitPrice"
              type="number"
              min={0}
              value={item.unitPrice}
              onChange={(e) => update(i, { unitPrice: Number(e.target.value) || 0 })}
              className="input"
            />
            <input
              name="itemVatRate"
              type="number"
              min={0}
              max={100}
              value={item.vatRate}
              onChange={(e) => update(i, { vatRate: Number(e.target.value) || 0 })}
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

      <div className="flex justify-end gap-6 mt-3 text-[13px]">
        <div>
          <span className="heading-label mr-2">Base</span>
          {formatCurrency(base)}
        </div>
        <div>
          <span className="heading-label mr-2">VAT</span>
          {formatCurrency(vat)}
        </div>
        <div className="font-semibold">
          <span className="heading-label mr-2">To pay</span>
          {formatCurrency(base + vat)}
        </div>
      </div>
    </div>
  );
}
