import path from "path";
import { StyleSheet, Font } from "@react-pdf/renderer";
import type { CurrencyCode } from "@/lib/format";

export const DEFAULT_ACCENT = "#ec3013";
export const INK = "#201e1d";

// The built-in "Helvetica" standard font only covers WinAnsi (cp1252), which
// is missing ě/ř/ů/ď/ť/ň — real Czech diacritics were silently dropping from
// PDFs (e.g. "Vojtěšská" -> "Vojtská"). Neue Regrade covers all of them, so
// it's registered here once and shared by both the invoice and quote PDFs.
// Same file registered at both weights since it's the only style file kept
// on disk — react-pdf needs *a* match for `fontWeight: 700` or it throws.
const FONT_PATH = path.join(process.cwd(), "src/fonts/neue-regrade/NeueRegrade-Variable.ttf");
Font.register({
  family: "NeueRegrade",
  fonts: [
    { src: FONT_PATH, fontWeight: 400 },
    { src: FONT_PATH, fontWeight: 700 },
  ],
});

const CURRENCY_LOCALE: Record<CurrencyCode, string> = { CZK: "cs-CZ", EUR: "de-DE", USD: "en-US" };

export function money(n: number, currency: CurrencyCode = "CZK") {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function pdfDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export const sharedStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: INK, fontFamily: "NeueRegrade" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  companyName: { fontSize: 14, fontWeight: 700 },
  docLabel: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: "#666", textAlign: "right" },
  docNumber: { fontSize: 13, fontWeight: 700, textAlign: "right" },
  rule: { height: 2, backgroundColor: INK, marginVertical: 12 },
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  partyBlock: { width: "48%" },
  label: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: "#666", marginBottom: 3 },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: 9, color: "#444" },
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
  logoImage: { width: 40, height: 40, objectFit: "contain", marginBottom: 4 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  footerText: { fontSize: 8, color: "#666", width: "70%" },
  qrImage: { width: 72, height: 72 },
});
