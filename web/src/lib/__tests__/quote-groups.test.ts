import { describe, expect, it } from "vitest";
import { duplicateGroupNames, groupsFromItems, itemsFromGroups, type FlatItem } from "@/lib/quote-groups";

const item = (description: string, category: string): FlatItem => ({ description, quantity: 1, unitPrice: 100, vatRate: 21, category });

describe("quote item groups", () => {
  it("groups items by category in first-appearance order, keeping uncategorised ones apart", () => {
    const { groups, loose } = groupsFromItems([item("Mic", "Audio"), item("Screen", "Video"), item("Speaker", "Audio"), item("Taxi", "")]);
    expect(groups.map((g) => [g.name, g.items.map((i) => i.description)])).toEqual([
      ["Audio", ["Mic", "Speaker"]],
      ["Video", ["Screen"]],
    ]);
    expect(loose.map((i) => i.description)).toEqual(["Taxi"]);
  });

  it("flattens groups back with the group name as each item's category, ungrouped items last", () => {
    const { groups, loose } = groupsFromItems([item("Taxi", ""), item("Mic", "Audio"), item("Screen", "Video")]);
    groups[0].name = "  Sound  ";
    expect(itemsFromGroups(groups, loose)).toEqual([
      { description: "Mic", quantity: 1, unitPrice: 100, vatRate: 21, category: "Sound" },
      { description: "Screen", quantity: 1, unitPrice: 100, vatRate: 21, category: "Video" },
      { description: "Taxi", quantity: 1, unitPrice: 100, vatRate: 21, category: "" },
    ]);
  });

  it("flags group names used twice, ignoring case and spaces", () => {
    const { groups } = groupsFromItems([item("a", "Audio"), item("b", "Video")]);
    groups[1].name = " audio ";
    expect([...duplicateGroupNames(groups)]).toEqual(["audio"]);
  });
});
