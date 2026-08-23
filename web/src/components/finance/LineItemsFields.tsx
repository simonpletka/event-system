"use client";

import { Fragment } from "react";
import { formatCurrency, type CurrencyCode } from "@/lib/format";
import type { Dictionary } from "@/lib/dictionary";

export type LineItem = { description: string; quantity: number; unitPrice: number; vatRate: number; category: string };

export const BLANK_ITEM: LineItem = { description: "", quantity: 1, unitPrice: 0, vatRate: 21, category: "" };

type T = Dictionary["finance"]["lineItems"];

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
  t,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currency?: CurrencyCode;
  categories: string[];
  t: T;
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
      {/*
        Header + every item row are children of ONE grid, not separate
        per-row grids — that's deliberate. Two independent grids sharing
        the same column template can still end up with different pixel
        widths per column: the trailing `auto` column sizes to its own
        row's content, and the header row (empty last cell) vs. an item
        row (a real "Remove" button) resolved to different `auto` widths,
        which then pushed every column after Description out of alignment
        by a growing amount — confirmed from a screenshot showing the drift
        widening left-to-right. A single shared grid guarantees every
        column is exactly the same width in every row, header included.
      */}
      <div className="hidden md:grid grid-cols-[24px_1fr_110px_70px_110px_70px_auto] gap-2 items-center [&>.heading-label]:font-bold [&>.heading-label]:!text-[9px]">
        <span></span>
        <span className="heading-label">{t.colDescription}</span>
        <span className="heading-label">{t.colCategory}</span>
        <span className="heading-label">{t.colQty}</span>
        <span className="heading-label">{t.colUnitPrice}</span>
        <span className="heading-label">{t.colVat}</span>
        <span></span>

        {items.map((item, i) => (
          <Fragment key={i}>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-[9px] leading-none disabled:opacity-20"
                title={t.moveUp}
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="text-[9px] leading-none disabled:opacity-20"
                title={t.moveDown}
              >
                ▼
              </button>
            </div>
            <input
              name="itemDescription"
              value={item.description}
              onChange={(e) => update(i, { description: e.target.value })}
              className="input"
              placeholder={t.descriptionPlaceholder}
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
              {t.removeBtn}
            </button>
          </Fragment>
        ))}
      </div>

      {/* Mobile: the 7-column shared grid above can't survive a 375px
          viewport, so each item becomes its own card instead — same
          update/move/onChange handlers, just different markup. */}
      <div className="md:hidden flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="card p-3.5">
            <div className="flex gap-2 mb-2.5">
              <input
                value={item.description}
                onChange={(e) => update(i, { description: e.target.value })}
                className="input flex-1"
                placeholder={t.descriptionPlaceholder}
              />
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title={t.moveUp}
                  className="w-[26px] h-5 rounded-md border border-ink/18 flex items-center justify-center text-[11px] leading-none disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  title={t.moveDown}
                  className="w-[26px] h-5 rounded-md border border-ink/18 flex items-center justify-center text-[11px] leading-none disabled:opacity-20"
                >
                  ▼
                </button>
              </div>
            </div>
            <input
              list="line-item-categories"
              placeholder={t.colCategory}
              value={item.category}
              onChange={(e) => update(i, { category: e.target.value })}
              className="input mb-2.5"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="heading-label block mb-1">{t.colQty}</label>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) || 1 })}
                  onFocus={(e) => e.target.select()}
                  className="input"
                />
              </div>
              <div className="flex-1">
                <label className="heading-label block mb-1">{t.colUnitPrice}</label>
                <input
                  type="number"
                  min={0}
                  value={item.unitPrice}
                  onChange={(e) => update(i, { unitPrice: Number(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  className="input"
                />
              </div>
              <div className="flex-1">
                <label className="heading-label block mb-1">{t.colVat}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={item.vatRate}
                  onChange={(e) => update(i, { vatRate: Number(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  className="input"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="btno !border-warning text-warning w-full text-center mt-2.5 text-[9px]"
            >
              {t.removeBtn}
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => onChange([...items, { ...BLANK_ITEM }])} className="btno mt-2 text-[9px]">
        {t.addItem}
      </button>

      <div className="flex justify-end items-center gap-6 mt-3 text-[13px]">
        <div>
          <span className="heading-label mr-2">{t.base}</span>
          {formatCurrency(base, currency)}
        </div>
        <div>
          <span className="heading-label mr-2">{t.vat}</span>
          {formatCurrency(vat, currency)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="heading-label mr-1">{t.toPay}</span>
          <span className="font-semibold text-base">{formatCurrency(base + vat, currency)}</span>
          <span className="tag tag-neutral">{currency}</span>
        </div>
      </div>
    </div>
  );
}
