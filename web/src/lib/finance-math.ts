import type { DiscountType } from "@/generated/prisma/enums";

/**
 * Quote/invoice money math shared by the web forms (lib/actions/finance.ts)
 * and the Claude connector (lib/agent/) — kept out of the "use server" actions
 * file since that one may only export async functions.
 */

export function itemsTotal(items: { quantity: number; unitPrice: number; vatRate: number }[]) {
  return Math.round(items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (1 + i.vatRate / 100), 0));
}

/** Pre-VAT base — what a Quote's own `subtotal` stores (an Invoice's goes through applyDiscount instead, since a discount is applied to the base). */
export function itemsBase(items: { quantity: number; unitPrice: number }[]) {
  return Math.round(items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0));
}

/**
 * Discount is applied to the pre-VAT base, then VAT is recomputed on the
 * discounted base — not a flat cut off the final total. That's both the
 * legally correct way to handle a discounted invoice (VAT is owed on what
 * was actually charged) and the more common real-world behavior. Returns
 * the discounted base too (stored as the invoice's `subtotal`), not just
 * the final VAT-inclusive total.
 */
export function applyDiscount(
  items: { quantity: number; unitPrice: number; vatRate: number }[],
  discountType: DiscountType,
  discountValue: number
) {
  const base = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  if (discountType === "NONE" || discountValue <= 0) {
    return { total: Math.round(base + vat), subtotal: Math.round(base), discountAmount: 0 };
  }
  const avgVatRate = base > 0 ? vat / base : 0;
  const discountAmount =
    discountType === "PERCENT" ? Math.round(base * (Math.min(100, discountValue) / 100)) : Math.min(base, discountValue);
  const discountedBase = base - discountAmount;
  const discountedVat = discountedBase * avgVatRate;
  return { total: Math.round(discountedBase + discountedVat), subtotal: Math.round(discountedBase), discountAmount };
}
