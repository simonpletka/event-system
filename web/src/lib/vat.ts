/**
 * Per-VAT-rate base / VAT breakdown for an invoice.
 *
 * A discount is stored only as the final post-discount `total`; the individual
 * line items still hold their pre-discount `unitPrice`. Scaling every line by
 * `total / grossBeforeDiscount` reproduces the exact blended-VAT total the app's
 * own `applyDiscount()` produces (see `lib/actions/finance.ts`) while letting
 * each line keep its real VAT rate — so a correct per-rate split falls out.
 *
 * The ISDOC e-invoice builder (`lib/isdoc.ts`) and the finance report both read
 * VAT-by-rate from here, so the two can never drift.
 */

export type VatLine = { quantity: number; unitPrice: number; vatRate: number };

/** Proportional factor that spreads an invoice's discount across its lines. 1 when there is no discount. */
export function discountFactor(items: VatLine[], total: number): number {
  const base = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const gross = base + vat;
  return gross > 0 ? Math.max(0, Math.min(1, total / gross)) : 1;
}

/**
 * Map of `vatRate` → `{ base, vat }`, post-discount, **not rounded** — callers
 * round after converting to their target currency. `base` is the pre-VAT amount,
 * `vat` the tax on it, both in the invoice's own currency.
 */
export function vatBucketsForInvoice(items: VatLine[], total: number): Map<number, { base: number; vat: number }> {
  const factor = discountFactor(items, total);
  const buckets = new Map<number, { base: number; vat: number }>();
  for (const item of items) {
    const lineBase = item.quantity * item.unitPrice * factor;
    const lineVat = lineBase * (item.vatRate / 100);
    const b = buckets.get(item.vatRate) ?? { base: 0, vat: 0 };
    b.base += lineBase;
    b.vat += lineVat;
    buckets.set(item.vatRate, b);
  }
  return buckets;
}
