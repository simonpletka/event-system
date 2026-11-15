import type { AddressSuggestion } from "@/lib/address-search";

/** Lowercase, accents stripped: "Kongresové" and "kongresove" match. */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Venues already used on projects that match what's typed, as suggestions:
 * every word typed must appear in the name (or address), one entry per
 * name+address, names that start with the query first. Pure, so it's
 * testable; the route feeds it the venues the user's projects have.
 */
export function matchSavedVenues(
  venues: { name: string; address: string }[],
  query: string,
  limit = 5
): AddressSuggestion[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const q = words.join(" ");

  const seen = new Set<string>();
  const hits: { v: { name: string; address: string }; starts: boolean }[] = [];
  for (const v of venues) {
    const name = v.name.trim();
    if (!name) continue;
    const key = `${foldText(name)}|${foldText(v.address)}`;
    if (seen.has(key)) continue;
    const haystack = `${foldText(name)} ${foldText(v.address)}`;
    if (!words.every((w) => haystack.includes(w))) continue;
    seen.add(key);
    hits.push({ v: { name, address: v.address.trim() }, starts: foldText(name).startsWith(q) });
  }
  hits.sort((a, b) => Number(b.starts) - Number(a.starts) || a.v.name.localeCompare(b.v.name));

  return hits.slice(0, limit).map(({ v }) => ({
    label: v.address ? `${v.name}, ${v.address}` : v.name,
    name: v.name,
    address: v.address,
    saved: true,
    lat: 0,
    lon: 0,
    street: "",
    city: "",
    postCode: "",
    state: "",
  }));
}

/** Saved venues first, then map results that aren't the same place again (same name and address). */
export function mergePlaceSuggestions(saved: AddressSuggestion[], map: AddressSuggestion[], limit = 7): AddressSuggestion[] {
  const key = (s: AddressSuggestion) => `${foldText(s.name ?? "")}|${foldText(s.address ?? "")}`;
  const savedKeys = new Set(saved.map(key));
  return [...saved, ...map.filter((m) => !savedKeys.has(key(m)))].slice(0, limit);
}
