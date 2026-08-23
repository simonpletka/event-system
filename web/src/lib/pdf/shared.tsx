import path from "path";
import { StyleSheet, Font } from "@react-pdf/renderer";
import type { CurrencyCode } from "@/lib/format";
import type { PdfLang } from "./i18n";

export const DEFAULT_ACCENT = "#ec3013";
export const INK = "#201e1d";

// The built-in "Helvetica" standard font only covers WinAnsi (cp1252), which
// is missing ě/ř/ů/ď/ť/ň — real Czech diacritics were silently dropping from
// PDFs (e.g. "Vojtěšská" -> "Vojtská"). Neue Regrade covers all of them.
// Same file registered at both weights since it's the only style file kept
// on disk — react-pdf needs *a* match for `fontWeight: 700` or it throws.
const FONT_PATH = path.join(process.cwd(), "src/fonts/neue-regrade/NeueRegrade-Variable.ttf");

// Deliberately NOT registered once at module scope under a fixed family name.
// @react-pdf/font's FontStore caches the loaded fontkit font object per
// family+weight for the lifetime of the process, and its glyph-subsetting
// state turned out to leak across unrelated renderToBuffer() calls: an
// invoice PDF rendered first would silently corrupt specific digit glyphs
// (found in testing: "3" and "4") in a quote PDF rendered afterwards in the
// same long-running Next.js server process — reproducible and deterministic,
// confirmed via pdfminer text extraction, and gone once each render gets its
// own family name. registerAppFont() is called fresh inside each PDF
// component's render body so every document gets an independent FontSource
// and thus independent subsetting state, at the cost of re-parsing a small
// local TTF file per PDF (irrelevant for this app's request volume).
export function registerAppFont(): string {
  const family = `NeueRegrade-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  Font.register({
    family,
    fonts: [
      { src: FONT_PATH, fontWeight: 400 },
      { src: FONT_PATH, fontWeight: 700 },
    ],
  });
  return family;
}

const CURRENCY_LOCALE: Record<CurrencyCode, string> = { CZK: "cs-CZ", EUR: "de-DE", USD: "en-US" };

export function money(n: number, currency: CurrencyCode = "CZK") {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function pdfDate(d: Date, lang: PdfLang = "en") {
  return new Intl.DateTimeFormat(lang === "cs" ? "cs-CZ" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Best-effort visual split of a free-text address into up to 3 display
 * lines. The app doesn't store a structured address for a Company or an
 * Event's embedded company fields (only the separate Client model does —
 * see formatClientAddress) — most of these strings were entered through
 * the Photon autocomplete though, which formats as "street, postcode city,
 * state", so splitting on commas usually reproduces the intended rows.
 * Overflow past 3 segments is folded into the last line rather than
 * dropped. Purely a rendering-layer convenience, not real structured data.
 */
export function addressLines(address: string): string[] {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 3) return parts;
  return [parts[0], parts[1], parts.slice(2).join(", ")];
}

/** Structured address lines for a linked Client — matches formatClientAddress's row grouping. */
export function clientAddressLines(client: { street: string; city: string; postCode: string; state: string }): string[] {
  const cityLine = [client.postCode, client.city].filter(Boolean).join(" ");
  return [client.street, cityLine, client.state].filter(Boolean);
}

export const sharedStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: INK },

  // Big lowercase wordmark header: doc word on the left, logo/initial chip + supplier name top-right.
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  wordmark: { fontSize: 56, fontWeight: 700, lineHeight: 0.85, letterSpacing: -1.5 },
  headerSupplier: { alignItems: "flex-end", gap: 3 },
  initialChip: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  initialChipText: { fontSize: 10, fontWeight: 700, color: "#ffffff" },
  headerSupplierName: { fontSize: 10, fontWeight: 700 },
  logoImage: { width: 28, height: 28, objectFit: "contain" },

  // Big date/doc-number row, replacing the old thin rule + small docLabel.
  bigDateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16 },
  bigDateStack: { flexDirection: "column" },
  bigDateLine: { fontSize: 12, lineHeight: 1.35 },
  bigDocNumber: { fontSize: 12, fontWeight: 700 },

  partiesRow: { flexDirection: "row", marginTop: 20, marginBottom: 16, gap: 14 },
  partyBlockNarrow: { width: "24%" },
  partyBlockWide: { width: "29%" },
  label: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: "#666", marginBottom: 3 },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: 9, color: "#444", lineHeight: 1.45 },

  // Invoice-only: payment-details column (text) beside its own QR column.
  paymentBlock: { width: "32%" },
  qrBlock: { width: "14%" },
  qrBox: { backgroundColor: "#f3f2f2", borderRadius: 6, padding: 5, width: 52, alignSelf: "flex-start" },
  qrImageSmall: { width: 42, height: 42 },
  qrCaptionText: { fontSize: 7, color: "#666", marginTop: 4, lineHeight: 1.3 },

  table: { marginTop: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  colDesc: { width: "46%" },
  colQty: { width: "12%", textAlign: "right" },
  colUnit: { width: "16%", textAlign: "right" },
  colVat: { width: "10%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  th: { fontSize: 8, letterSpacing: 0.6, textTransform: "uppercase", color: "#666" },
  summaryRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, gap: 24 },
  summaryBlock: { alignItems: "flex-end" },
  summaryValue: { fontSize: 10 },
  toPayValue: { fontSize: 14, fontWeight: 700 },
  footerRow: {
    marginTop: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  footerText: { fontSize: 8, color: "#666" },
});
