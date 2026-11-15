/**
 * The quote form edits items inside named groups (a group = a category
 * heading on the quote); the database and PDF keep a flat item list where
 * each item carries its group's name as `category`. These convert between
 * the two. A group's name is free text, so a group made just for one quote
 * never reaches the saved category list in Settings.
 */

export type FlatItem = { description: string; quantity: number; unitPrice: number; vatRate: number; category: string };
export type GroupItem = { key: string; description: string; quantity: number; unitPrice: number; vatRate: number };
export type ItemGroup = { key: string; name: string; items: GroupItem[] };

let counter = 0;
/** A React key for a group or item that stays the same while it moves around. */
export function newKey(): string {
  counter += 1;
  return `k${counter}`;
}

export function blankGroupItem(): GroupItem {
  return { key: newKey(), description: "", quantity: 1, unitPrice: 0, vatRate: 21 };
}

/** Flat items → groups in order of first appearance, plus the items with no category. */
export function groupsFromItems(items: FlatItem[]): { groups: ItemGroup[]; loose: GroupItem[] } {
  const groups: ItemGroup[] = [];
  const loose: GroupItem[] = [];
  for (const { category, ...rest } of items) {
    const item = { key: newKey(), ...rest };
    const name = category.trim();
    if (!name) {
      loose.push(item);
      continue;
    }
    const group = groups.find((g) => g.name === name);
    if (group) group.items.push(item);
    else groups.push({ key: newKey(), name, items: [item] });
  }
  return { groups, loose };
}

/**
 * Groups → flat items, group by group and then the items with no group,
 * which is also the order the quote shows them in.
 */
export function itemsFromGroups(groups: ItemGroup[], loose: GroupItem[]): FlatItem[] {
  const strip = (i: GroupItem) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate });
  return [
    ...groups.flatMap((g) => g.items.map((item) => ({ ...strip(item), category: g.name.trim() }))),
    ...loose.map((item) => ({ ...strip(item), category: "" })),
  ];
}

/** Names used by more than one group (ignoring case and surrounding spaces); their items would merge on the quote. */
export function duplicateGroupNames(groups: ItemGroup[]): Set<string> {
  const seen = new Map<string, number>();
  for (const g of groups) {
    const name = g.name.trim().toLowerCase();
    if (name) seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([name]) => name));
}
