/**
 * Groups quote/invoice line items by their (free-text) category, preserving
 * first-appearance order — used by both the on-screen quote/invoice preview
 * and the generated PDF so the two stay visually consistent. Uncategorized
 * items (blank category) are grouped last, unlabeled. A default category
 * with zero items assigned to it on this particular document just never
 * appears — there's nothing to render.
 */
export function groupItemsByCategory<T extends { category: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : 0));
  return keys.map((category) => ({ category, items: groups.get(category)! }));
}

export function categoryTotal(items: { quantity: number; unitPrice: number; vatRate: number }[]) {
  return Math.round(items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (1 + i.vatRate / 100), 0));
}
