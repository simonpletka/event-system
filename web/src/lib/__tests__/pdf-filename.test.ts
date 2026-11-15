import { describe, expect, it } from "vitest";
import { quotePdfFilename } from "@/lib/pdf/filename";

describe("quotePdfFilename", () => {
  it("names a quote <number>.<project>_quote / _nabidka", () => {
    expect(quotePdfFilename("26-012", "Charity Gala", "en")).toBe("26-012.Charity-Gala_quote.pdf");
    expect(quotePdfFilename("26-012", "Charity Gala", "cs")).toBe("26-012.Charity-Gala_nabidka.pdf");
  });

  it("makes the project name file-safe", () => {
    expect(quotePdfFilename("26-003_v2", "Zimní gala / VIP — Žofín", "cs")).toBe("26-003_v2.Zimni-gala-VIP-Zofin_nabidka.pdf");
  });

  it("leaves the project out when nothing usable is left", () => {
    expect(quotePdfFilename("26-001", "  ", "en")).toBe("26-001_quote.pdf");
  });
});
