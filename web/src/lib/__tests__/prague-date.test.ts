import { describe, expect, it } from "vitest";
import { parsePragueDateTime, toPragueInput } from "../prague-date";

describe("Prague form dates", () => {
  it("reads a typed time as Prague time, whatever the server's timezone", () => {
    // 10:00 in Prague is 09:00 UTC in winter and 08:00 UTC in summer.
    expect(parsePragueDateTime("2026-11-20T10:00").toISOString()).toBe("2026-11-20T09:00:00.000Z");
    expect(parsePragueDateTime("2026-07-20T10:00").toISOString()).toBe("2026-07-20T08:00:00.000Z");
  });

  it("leaves a date without a time as before", () => {
    expect(parsePragueDateTime("2026-11-20").toISOString()).toBe("2026-11-20T00:00:00.000Z");
  });

  it("fills a field with Prague time, and reads back the same instant", () => {
    const instant = new Date("2026-03-29T00:30:00.000Z"); // the night the clocks change
    expect(toPragueInput(instant)).toBe("2026-03-29T01:30");
    expect(toPragueInput(instant, false)).toBe("2026-03-29");
    expect(parsePragueDateTime(toPragueInput(instant)).toISOString()).toBe(instant.toISOString());
  });
});
