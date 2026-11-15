import { describe, expect, it } from "vitest";
import { quotePdfFilename } from "@/lib/pdf/filename";

describe("quotePdfFilename", () => {
  it("names a quote <number>.<project>-quote / -nabidka, spaces as _", () => {
    expect(quotePdfFilename("26-012", "Charity Gala", "en")).toBe("26-012.Charity_Gala-quote.pdf");
    expect(quotePdfFilename("26-012", "Charity Gala", "cs")).toBe("26-012.Charity_Gala-nabidka.pdf");
  });

  it("makes the project name file-safe and keeps its own hyphens", () => {
    expect(quotePdfFilename("26-003_v2", "Zimní gala / VIP — Žofín", "cs")).toBe("26-003_v2.Zimni_gala_VIP_Zofin-nabidka.pdf");
    expect(quotePdfFilename("26-004", "Pre-show party", "en")).toBe("26-004.Pre-show_party-quote.pdf");
  });

  it("leaves the project out when nothing usable is left", () => {
    expect(quotePdfFilename("26-001", "  ", "en")).toBe("26-001-quote.pdf");
  });
});
