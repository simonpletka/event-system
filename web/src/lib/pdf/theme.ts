/**
 * Light and dark look of the quote and invoice PDFs, and of their on-page
 * previews. Plain data with no react-pdf import, so the preview pages can
 * read the same values: react-pdf styles are built from it in shared.tsx
 * (themedStyles), the preview's inline styles in
 * components/finance/document-preview-styles.ts. Keeping both on these
 * numbers is what stops the preview and the PDF drifting apart.
 */

export type PdfTheme = "light" | "dark";
export const DEFAULT_PDF_THEME: PdfTheme = "light";

/** `?theme=` / `?previewTheme=` value → theme; anything but "dark" is light. */
export function parsePdfTheme(value: unknown): PdfTheme {
  return value === "dark" ? "dark" : "light";
}

export type PdfPalette = {
  /** Page background. */
  bg: string;
  /** Main text: wordmark, dates, names, table cells, totals. */
  ink: string;
  /** Secondary text: address lines, project name, footer. */
  body: string;
  /** Uppercase labels and column headings. */
  muted: string;
  /** Row separators and the footer rule. */
  rule: string;
  /** The heavier rule under the table's column headings. */
  tableHeaderRule: string;
  /** Box behind the QR code (the QR image itself is black on white). */
  qrBox: string;
  qrBoxBorder: string;
};

export const PDF_PALETTES: Record<PdfTheme, PdfPalette> = {
  light: {
    bg: "#ffffff",
    ink: "#33302c",
    body: "#55514b",
    muted: "#6f6b64",
    rule: "#e4e1dc",
    tableHeaderRule: "#33302c",
    // A white QR on a white page needs an edge to read as a box.
    qrBox: "#ffffff",
    qrBoxBorder: "#e4e1dc",
  },
  // Dark grey, not black: a near-black page reads as a void on screen and
  // prints as a slab of ink.
  dark: {
    bg: "#2a2826",
    ink: "#f3f2f2",
    body: "#dedcd7",
    muted: "#b0aca5",
    rule: "#4a4541",
    tableHeaderRule: "#f3f2f2",
    qrBox: "#f3f2f2",
    qrBoxBorder: "#f3f2f2",
  },
};

/**
 * Type sizes and spacing shared by both documents, in PDF points (A4 page is
 * 595.28pt wide). The preview draws the same page at 96 dpi, 794px wide, so
 * every value converts with toPreviewPx (px = pt / 0.75).
 */
export const PDF_METRICS = {
  page: { paddingTop: 42, paddingRight: 42, paddingBottom: 48, paddingLeft: 42 },
  wordmark: { fontSize: 115.5, letterSpacing: -3, paddingBottom: 10.5 },
  headerSupplier: { gap: 4.5, paddingTop: 6, chip: 25.5, chipRadius: 6, chipText: 10.5, name: 9 },
  /** Issued / valid-until (due) lines and the document number. Quote rows sit lower: its wordmark has a descender. */
  dateRow: { marginTopInvoice: 28.5, marginTopQuote: 45, fontSize: 14.25, lineHeight: 1.35 },
  docProject: { fontSize: 11.5, marginTop: 4 },
  parties: { marginTop: 30, marginBottom: 22 },
  label: { fontSize: 7.5, letterSpacing: 0.6, marginBottom: 5 },
  partyName: { fontSize: 10.5, marginBottom: 3 },
  partyLine: { fontSize: 9, lineHeight: 1.45 },
  idsMarginTop: 3,
  qr: { image: 48, padding: 4.5, radius: 6, borderWidth: 0.75, captionSize: 7.5, captionMarginTop: 4, captionLineHeight: 1.4 },
  tableHeader: { paddingBottom: 6, marginBottom: 2, borderWidth: 1.5 },
  th: { fontSize: 7.5, letterSpacing: 0.5 },
  tableRow: { paddingVertical: 7, paddingVerticalNoPrices: 5.5, borderWidth: 0.75 },
  tableCell: { fontSize: 10 },
  categoryLabel: { fontSize: 8, letterSpacing: 0.6, marginTop: 22, marginBottom: 2 },
  categorySubtotal: { fontSize: 10, marginTop: 5, marginBottom: 6 },
  summary: { marginTop: 22, gap: 32, valueSize: 10.5, valueMarginTop: 3, toPaySize: 20, toPayMarginTop: 2 },
  /** The quote's footer has the validity note on the left and who issued it on the right, `gap` apart. */
  footer: { paddingTop: 12, borderWidth: 0.75, fontSize: 8.5, lineHeight: 1.5, gap: 24 },
} as const;

/** Column widths of the parties row (% of the content width) and the gap between them, per document. */
export const PDF_PARTY_COLUMNS = {
  // supplier · customer (who issued the quote is in the footer)
  quote: { gap: 20, widths: ["32%", "32%"] },
  // supplier · customer · payment details · QR. Payment details must fit a
  // Czech IBAN on one line (about 133pt at 9pt); the QR column only needs its
  // box (48pt image + padding + border ≈ 58.5pt).
  invoice: { gap: 12, widths: ["27%", "27%", "27%", "11.5%"] },
} as const;

/** Table columns: item · qty · unit price · VAT · total (% of the content width). */
export const PDF_TABLE_COLUMNS = { desc: "46%", qty: "12%", unit: "16%", vat: "10%", total: "16%" } as const;

/** A PDF point value as preview pixels (A4 at 96 dpi). */
export function toPreviewPx(pt: number): number {
  return Math.round((pt / 0.75) * 100) / 100;
}
