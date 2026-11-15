import path from "path";
import { StyleSheet, Font } from "@react-pdf/renderer";
import type { CurrencyCode } from "@/lib/format";
import type { PdfLang } from "./i18n";
import { PDF_METRICS as M, PDF_PALETTES, PDF_TABLE_COLUMNS, DEFAULT_PDF_THEME, type PdfTheme } from "./theme";

export const DEFAULT_ACCENT = "#ec3013";

// The built-in "Helvetica" standard font only covers WinAnsi (cp1252), which
// is missing ě/ř/ů/ď/ť/ň — real Czech diacritics were silently dropping from
// PDFs (e.g. "Vojtěšská" -> "Vojtská"). Neue Regrade covers all of them.
//
// Two separate STATIC instances, not the variable TTF used elsewhere (the
// live app's `next/font/local` in layout.tsx uses the variable file directly
// and that's correct — browsers interpolate variable-font weight axes fine).
// react-pdf's font pipeline (fontkit) does not: registering the same
// variable file under both fontWeight 400 and 700 silently produced
// IDENTICAL glyph outlines for both — fontkit loads a variable font at its
// default axis position (this file's default is wght=300) regardless of the
// nominal `fontWeight` key react-pdf was told to associate it with, and
// fontkit's own subsetting of a live variation instance
// (`font.getVariation({wght:700}).createSubset()`) throws outright — a
// known rough edge, not something to build around at request time. Fixed at
// the source instead: `fonttools varLib.instancer` (already used elsewhere
// in this project to inspect this same font) flattens the variable font
// into two real static instances at build-prep time, committed to disk —
// confirmed visually distinct (Pillow render, plain vs. clearly bold
// strokes) before wiring them in.
const FONT_PATH_REGULAR = path.join(process.cwd(), "src/fonts/neue-regrade/NeueRegrade-Regular.ttf");
const FONT_PATH_BOLD = path.join(process.cwd(), "src/fonts/neue-regrade/NeueRegrade-Bold.ttf");

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
      { src: FONT_PATH_REGULAR, fontWeight: 400 },
      { src: FONT_PATH_BOLD, fontWeight: 700 },
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

/** "IČO … · DIČ …" for a party, skipping an empty one instead of printing a bare label. */
export function documentIds(ico: string, dic: string) {
  return [ico && `IČO ${ico}`, dic && `DIČ ${dic}`].filter(Boolean).join(" · ");
}

/** " · email · phone" after the issuer's name in the footer, skipping what's empty. */
export function issuedByContact(person: { email: string; phone: string }) {
  return [person.email, person.phone]
    .filter(Boolean)
    .map((part) => ` · ${part}`)
    .join("");
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

// Every size below is in points. The original mockup was a 794×1123 CSS-px
// artboard, exactly A4 at 96 DPI, and the PDF page is A4 in points, so the
// two convert with pt = px × 0.75 (and the preview back with px = pt / 0.75,
// toPreviewPx in theme.ts). Sizes and colours come from theme.ts, which the
// on-page preview reads too.
function buildStyles(theme: PdfTheme) {
  const c = PDF_PALETTES[theme];
  return StyleSheet.create({
    page: { ...M.page, fontSize: 10, color: c.ink, backgroundColor: c.bg },

    // Big lowercase wordmark: document word on the left, logo/initial chip + supplier name top-right.
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    wordmark: { fontSize: M.wordmark.fontSize, fontWeight: 700, lineHeight: 0.8, letterSpacing: M.wordmark.letterSpacing, paddingBottom: M.wordmark.paddingBottom },
    headerSupplier: { alignItems: "flex-end", gap: M.headerSupplier.gap, paddingTop: M.headerSupplier.paddingTop },
    initialChip: {
      width: M.headerSupplier.chip,
      height: M.headerSupplier.chip,
      borderRadius: M.headerSupplier.chipRadius,
      alignItems: "center",
      justifyContent: "center",
    },
    initialChipText: { fontSize: M.headerSupplier.chipText, fontWeight: 700, color: "#ffffff" },
    headerSupplierName: { fontSize: M.headerSupplier.name, fontWeight: 700 },
    logoImage: { width: M.headerSupplier.chip, height: M.headerSupplier.chip, objectFit: "contain" },

    // Dates on the left, document number (and the quote's project) on the right.
    bigDateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: M.dateRow.marginTopInvoice },
    bigDateStack: { flexDirection: "column" },
    bigDateLine: { fontSize: M.dateRow.fontSize, lineHeight: M.dateRow.lineHeight },
    bigDocNumber: { fontSize: M.dateRow.fontSize, fontWeight: 700 },
    bigDocProject: { fontSize: M.docProject.fontSize, color: c.body, marginTop: M.docProject.marginTop, textAlign: "right" },

    // Each document supplies its own column widths and gap (PDF_PARTY_COLUMNS).
    partiesRow: { flexDirection: "row", marginTop: M.parties.marginTop, marginBottom: M.parties.marginBottom },
    label: {
      fontSize: M.label.fontSize,
      fontWeight: 700,
      letterSpacing: M.label.letterSpacing,
      textTransform: "uppercase",
      color: c.muted,
      marginBottom: M.label.marginBottom,
    },
    partyName: { fontSize: M.partyName.fontSize, fontWeight: 700, marginBottom: M.partyName.marginBottom },
    partyLine: { fontSize: M.partyLine.fontSize, color: c.body, lineHeight: M.partyLine.lineHeight },

    // Invoice only: the QR code in its own column.
    qrBox: {
      backgroundColor: c.qrBox,
      borderWidth: M.qr.borderWidth,
      borderColor: c.qrBoxBorder,
      borderRadius: M.qr.radius,
      padding: M.qr.padding,
      alignSelf: "flex-start",
    },
    qrImage: { width: M.qr.image, height: M.qr.image },
    qrCaptionText: { fontSize: M.qr.captionSize, color: c.muted, marginTop: M.qr.captionMarginTop, lineHeight: M.qr.captionLineHeight },

    // No marginTop: the parties row's marginBottom is the gap above the table.
    table: {},
    tableHeaderRow: {
      flexDirection: "row",
      borderBottomWidth: M.tableHeader.borderWidth,
      borderBottomColor: c.tableHeaderRule,
      paddingBottom: M.tableHeader.paddingBottom,
      marginBottom: M.tableHeader.marginBottom,
    },
    tableRow: { flexDirection: "row", paddingVertical: M.tableRow.paddingVertical, borderBottomWidth: M.tableRow.borderWidth, borderBottomColor: c.rule },
    tableRowNoPrices: { paddingVertical: M.tableRow.paddingVerticalNoPrices, borderBottomWidth: M.tableRow.borderWidth, borderBottomColor: c.rule },
    tableCell: { fontSize: M.tableCell.fontSize },
    colDesc: { width: PDF_TABLE_COLUMNS.desc },
    colQty: { width: PDF_TABLE_COLUMNS.qty, textAlign: "right" },
    colUnit: { width: PDF_TABLE_COLUMNS.unit, textAlign: "right" },
    colVat: { width: PDF_TABLE_COLUMNS.vat, textAlign: "right" },
    colTotal: { width: PDF_TABLE_COLUMNS.total, textAlign: "right" },
    th: { fontSize: M.th.fontSize, fontWeight: 700, letterSpacing: M.th.letterSpacing, textTransform: "uppercase", color: c.muted },
    categoryLabel: {
      fontSize: M.categoryLabel.fontSize,
      fontWeight: 700,
      letterSpacing: M.categoryLabel.letterSpacing,
      textTransform: "uppercase",
      color: c.muted,
      marginTop: M.categoryLabel.marginTop,
      marginBottom: M.categoryLabel.marginBottom,
    },
    categorySubtotal: {
      fontSize: M.categorySubtotal.fontSize,
      fontWeight: 700,
      textAlign: "right",
      marginTop: M.categorySubtotal.marginTop,
      marginBottom: M.categorySubtotal.marginBottom,
    },

    summaryRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: M.summary.marginTop, gap: M.summary.gap },
    summaryBlock: { alignItems: "flex-end" },
    summaryValue: { fontSize: M.summary.valueSize, marginTop: M.summary.valueMarginTop },
    toPayValue: { fontSize: M.summary.toPaySize, fontWeight: 700, marginTop: M.summary.toPayMarginTop },

    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: M.footer.gap,
      paddingTop: M.footer.paddingTop,
      borderTopWidth: M.footer.borderWidth,
      borderTopColor: c.rule,
    },
    footerText: { fontSize: M.footer.fontSize, color: c.body, lineHeight: M.footer.lineHeight },
    footerIssuedBy: { fontSize: M.footer.fontSize, color: c.body, lineHeight: M.footer.lineHeight, textAlign: "right", flexShrink: 1 },
    footerIssuedByName: { fontWeight: 700, color: c.ink },
  });
}

const stylesByTheme = new Map<PdfTheme, ReturnType<typeof buildStyles>>();

/** The quote/invoice PDF styles in the given theme (built once per theme). */
export function themedStyles(theme: PdfTheme = DEFAULT_PDF_THEME) {
  let styles = stylesByTheme.get(theme);
  if (!styles) {
    styles = buildStyles(theme);
    stylesByTheme.set(theme, styles);
  }
  return styles;
}
