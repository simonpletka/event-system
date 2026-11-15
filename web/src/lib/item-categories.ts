/**
 * The saved line-item categories a fresh database starts with, in quote
 * order. The live list is the ItemCategory table (Settings → Templates);
 * migration 20261116090000_default_item_categories set it to this list.
 */
export const DEFAULT_ITEM_CATEGORIES = ["Video", "Audio", "Lighting", "Accessories", "People", "Services"] as const;
