import type { CSSProperties, ReactNode } from "react";
import type { CurrencyCode } from "@/lib/format";
import { money } from "@/lib/pdf/shared";
import {
  PDF_METRICS as M,
  PDF_PALETTES,
  PDF_PARTY_COLUMNS,
  PDF_TABLE_COLUMNS,
  toPreviewPx as px,
  type PdfPalette,
  type PdfTheme,
} from "@/lib/pdf/theme";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";

/**
 * On-page preview of a quote or invoice PDF: the same A4 page drawn at 96 dpi
 * (794 × 1123 px), built from the same palette and point sizes as the PDF
 * (lib/pdf/theme.ts, px = pt / 0.75) and with inline styles only, so the app's
 * own theme classes can't leak in and the two can't drift apart. Server
 * component; DocumentPreviewScaler shrinks it to fit the card.
 */

/**
 * Link for the preview's language and theme switches. Always carries both
 * values, so switching one never resets the other.
 */
export function previewQuery(lang: "cs" | "en", theme: PdfTheme): string {
  return `?previewLang=${lang}&previewTheme=${theme}`;
}

type Item = { id: string; description: string; quantity: number; unitPrice: number; vatRate: number; category: string };

export type PreviewSummaryCell = { label: string; value: string; accent?: boolean };

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
// react-pdf sets text without a lineHeight tighter than the browser's default.
const PDF_LINE_HEIGHT = 1.2;

function labelStyle(c: PdfPalette): CSSProperties {
  return {
    fontSize: px(M.label.fontSize),
    fontWeight: 700,
    letterSpacing: px(M.label.letterSpacing),
    textTransform: "uppercase",
    color: c.muted,
    marginBottom: px(M.label.marginBottom),
  };
}

/** Building blocks for a parties column, styled like the PDF's. */
export function PreviewLabel({ theme, children }: { theme: PdfTheme; children: ReactNode }) {
  return <div style={labelStyle(PDF_PALETTES[theme])}>{children}</div>;
}

export function PreviewPartyName({ size = M.partyName.fontSize, children }: { size?: number; children: ReactNode }) {
  return <div style={{ fontSize: px(size), fontWeight: 700, marginBottom: px(M.partyName.marginBottom) }}>{children}</div>;
}

export function PreviewLine({
  theme,
  size = M.partyLine.fontSize,
  marginTop,
  breakAll,
  children,
}: {
  theme: PdfTheme;
  size?: number;
  marginTop?: number;
  breakAll?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: px(size),
        color: PDF_PALETTES[theme].body,
        lineHeight: M.partyLine.lineHeight,
        marginTop: marginTop === undefined ? undefined : px(marginTop),
        wordBreak: breakAll ? "break-all" : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** The invoice's QR code in its box, or the caption explaining why there is none. */
export function PreviewQr({ theme, qrDataUrl, caption }: { theme: PdfTheme; qrDataUrl: string | null; caption: string }) {
  const c = PDF_PALETTES[theme];
  const captionStyle: CSSProperties = {
    fontSize: px(M.qr.captionSize),
    color: c.muted,
    lineHeight: M.qr.captionLineHeight,
    marginTop: qrDataUrl ? px(M.qr.captionMarginTop) : 0,
  };
  return (
    <>
      {qrDataUrl && (
        <div
          style={{
            display: "inline-block",
            background: c.qrBox,
            border: `${px(M.qr.borderWidth)}px solid ${c.qrBoxBorder}`,
            borderRadius: px(M.qr.radius),
            padding: px(M.qr.padding),
            lineHeight: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not a static asset */}
          <img src={qrDataUrl} alt="" style={{ width: px(M.qr.image), height: px(M.qr.image) }} />
        </div>
      )}
      <div style={captionStyle}>{caption}</div>
    </>
  );
}

export function DocumentPreview({
  theme,
  kind,
  wordmark,
  accent,
  logoUrl,
  companyName,
  dateLines,
  number,
  project,
  parties,
  hideItemPrices,
  items,
  currency,
  columns,
  summary,
  footer,
}: {
  theme: PdfTheme;
  kind: "quote" | "invoice";
  /** "quote" / "nabídka" / "invoice" / "faktura" (shown lowercase). */
  wordmark: string;
  accent: string;
  logoUrl: string | null;
  companyName: string;
  /** Issued / valid-until (or due) lines. */
  dateLines: string[];
  number: string;
  /** Quote only: the project under the number. */
  project?: string;
  /** One node per parties column, in PDF_PARTY_COLUMNS order for the kind. */
  parties: ReactNode[];
  hideItemPrices: boolean;
  items: Item[];
  currency: CurrencyCode;
  columns: { item: string; qty: string; unit: string; vat: string; total: string };
  summary: PreviewSummaryCell[];
  footer: string;
}) {
  const c = PDF_PALETTES[theme];
  const partyCols = PDF_PARTY_COLUMNS[kind];
  const tableGrid = [PDF_TABLE_COLUMNS.desc, PDF_TABLE_COLUMNS.qty, PDF_TABLE_COLUMNS.unit, PDF_TABLE_COLUMNS.vat, PDF_TABLE_COLUMNS.total].join(" ");
  const groups = groupItemsByCategory(items);
  const right: CSSProperties = { textAlign: "right" };
  const th: CSSProperties = {
    fontSize: px(M.th.fontSize),
    fontWeight: 700,
    letterSpacing: px(M.th.letterSpacing),
    textTransform: "uppercase",
    color: c.muted,
  };
  const rowBorder = `${px(M.tableRow.borderWidth)}px solid ${c.rule}`;

  return (
    <div
      style={{
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        background: c.bg,
        color: c.ink,
        padding: `${px(M.page.paddingTop)}px ${px(M.page.paddingRight)}px ${px(M.page.paddingBottom)}px ${px(M.page.paddingLeft)}px`,
        display: "flex",
        flexDirection: "column",
        fontSize: px(10),
        lineHeight: PDF_LINE_HEIGHT,
        boxShadow: "0 2px 24px rgba(0,0,0,0.25)",
      }}
    >
      {/* Wordmark + logo/initial and supplier name */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div
          style={{
            fontSize: px(M.wordmark.fontSize),
            fontWeight: 700,
            lineHeight: 0.8,
            letterSpacing: px(M.wordmark.letterSpacing),
            paddingBottom: px(M.wordmark.paddingBottom),
            textTransform: "lowercase",
          }}
        >
          {wordmark}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: px(M.headerSupplier.gap),
            paddingTop: px(M.headerSupplier.paddingTop),
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset next/image can optimize
            <img src={logoUrl} alt="" style={{ width: px(M.headerSupplier.chip), height: px(M.headerSupplier.chip), objectFit: "contain" }} />
          ) : (
            <div
              style={{
                width: px(M.headerSupplier.chip),
                height: px(M.headerSupplier.chip),
                borderRadius: px(M.headerSupplier.chipRadius),
                background: accent,
                color: "#ffffff",
                fontSize: px(M.headerSupplier.chipText),
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: px(M.headerSupplier.name), fontWeight: 700 }}>{companyName}</div>
        </div>
      </div>

      {/* Dates · number (and project) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginTop: px(kind === "quote" ? M.dateRow.marginTopQuote : M.dateRow.marginTopInvoice),
        }}
      >
        <div style={{ fontSize: px(M.dateRow.fontSize), lineHeight: M.dateRow.lineHeight }}>
          {dateLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <div style={{ textAlign: "right", maxWidth: px(260) }}>
          <div style={{ fontSize: px(M.dateRow.fontSize), fontWeight: 700 }}>{number}</div>
          {project && (
            <div style={{ fontSize: px(M.docProject.fontSize), color: c.body, marginTop: px(M.docProject.marginTop) }}>{project}</div>
          )}
        </div>
      </div>

      {/* Parties */}
      <div
        style={{
          display: "flex",
          gap: px(partyCols.gap),
          marginTop: px(M.parties.marginTop),
          marginBottom: px(M.parties.marginBottom),
        }}
      >
        {parties.map((node, i) => (
          <div key={i} style={{ width: partyCols.widths[i], minWidth: 0, overflowWrap: "break-word" }}>
            {node}
          </div>
        ))}
      </div>

      {/* Items */}
      <div>
        {!hideItemPrices && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: tableGrid,
              borderBottom: `${px(M.tableHeader.borderWidth)}px solid ${c.tableHeaderRule}`,
              paddingBottom: px(M.tableHeader.paddingBottom),
              marginBottom: px(M.tableHeader.marginBottom),
            }}
          >
            <span style={th}>{columns.item}</span>
            <span style={{ ...th, ...right }}>{columns.qty}</span>
            <span style={{ ...th, ...right }}>{columns.unit}</span>
            <span style={{ ...th, ...right }}>{columns.vat}</span>
            <span style={{ ...th, ...right }}>{columns.total}</span>
          </div>
        )}
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.category && (
              <div
                style={{
                  fontSize: px(M.categoryLabel.fontSize),
                  fontWeight: 700,
                  letterSpacing: px(M.categoryLabel.letterSpacing),
                  textTransform: "uppercase",
                  color: c.muted,
                  marginTop: px(M.categoryLabel.marginTop),
                  marginBottom: px(M.categoryLabel.marginBottom),
                }}
              >
                {g.category}
              </div>
            )}
            {g.items.map((item) =>
              hideItemPrices ? (
                <div
                  key={item.id}
                  style={{ fontSize: px(M.tableCell.fontSize), padding: `${px(M.tableRow.paddingVerticalNoPrices)}px 0`, borderBottom: rowBorder }}
                >
                  {item.description}
                </div>
              ) : (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: tableGrid,
                    fontSize: px(M.tableCell.fontSize),
                    padding: `${px(M.tableRow.paddingVertical)}px 0`,
                    borderBottom: rowBorder,
                  }}
                >
                  <span>{item.description}</span>
                  <span style={right}>{item.quantity}</span>
                  <span style={right}>{money(item.unitPrice, currency)}</span>
                  <span style={right}>{item.vatRate}%</span>
                  <span style={right}>{money(item.quantity * item.unitPrice, currency)}</span>
                </div>
              )
            )}
            {hideItemPrices && g.category && (
              <div
                style={{
                  fontSize: px(M.categorySubtotal.fontSize),
                  fontWeight: 700,
                  textAlign: "right",
                  marginTop: px(M.categorySubtotal.marginTop),
                  marginBottom: px(M.categorySubtotal.marginBottom),
                }}
              >
                {money(categoryTotal(g.items), currency)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: px(M.summary.gap), marginTop: px(M.summary.marginTop) }}>
        {summary.map((cell) => (
          <div key={cell.label} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={labelStyle(c)}>{cell.label}</div>
            {cell.accent ? (
              <div style={{ fontSize: px(M.summary.toPaySize), fontWeight: 700, marginTop: px(M.summary.toPayMarginTop), color: accent }}>{cell.value}</div>
            ) : (
              <div style={{ fontSize: px(M.summary.valueSize), marginTop: px(M.summary.valueMarginTop) }}>{cell.value}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          paddingTop: px(M.footer.paddingTop),
          borderTop: `${px(M.footer.borderWidth)}px solid ${c.rule}`,
          fontSize: px(M.footer.fontSize),
          color: c.body,
          lineHeight: M.footer.lineHeight,
        }}
      >
        {footer}
      </div>
    </div>
  );
}
