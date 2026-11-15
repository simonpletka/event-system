import { describe, expect, it } from "vitest";
import { matchSavedVenues, mergePlaceSuggestions } from "@/lib/saved-venues";
import type { AddressSuggestion } from "@/lib/address-search";

const venues = [
  { name: "Fuchs2", address: "Plynární 1096/23, Praha 7" },
  { name: "Kongresové centrum Praha", address: "5. května 65, Praha 4" },
  { name: "fuchs2", address: "Plynární 1096/23, Praha 7" }, // same venue on another project
  { name: "Studio Fuchs", address: "Holešovice" },
  { name: "", address: "No name" },
];

describe("matchSavedVenues", () => {
  it("matches ignoring case and accents, once per venue", () => {
    const hits = matchSavedVenues(venues, "FUCHS");
    expect(hits.map((h) => h.name)).toEqual(["Fuchs2", "Studio Fuchs"]);
    expect(hits[0]).toMatchObject({ address: "Plynární 1096/23, Praha 7", saved: true });
  });

  it("needs every typed word, in the name or address", () => {
    expect(matchSavedVenues(venues, "kongresove praha").map((h) => h.name)).toEqual(["Kongresové centrum Praha"]);
    expect(matchSavedVenues(venues, "kongresove brno")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(matchSavedVenues(venues, "  ")).toEqual([]);
  });
});

describe("mergePlaceSuggestions", () => {
  const place = (name: string, address: string): AddressSuggestion => ({
    label: `${name}, ${address}`, name, address, lat: 1, lon: 1, street: "", city: "", postCode: "", state: "",
  });

  it("puts saved venues first and drops the same place from the map results", () => {
    const saved = matchSavedVenues(venues, "kongres");
    const merged = mergePlaceSuggestions(saved, [place("Kongresové centrum Praha", "5. května 65, Praha 4"), place("Kongres hotel", "Brno")]);
    expect(merged.map((m) => [m.name, Boolean(m.saved)])).toEqual([
      ["Kongresové centrum Praha", true],
      ["Kongres hotel", false],
    ]);
  });
});
