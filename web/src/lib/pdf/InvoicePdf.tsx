import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import type { CurrencyCode } from "@/lib/format";
import { DEFAULT_ACCENT, themedStyles, money, pdfDate as date, registerAppFont, documentIds } from "./shared";
import { pdfLabels, type PdfLang } from "./i18n";
import { DEFAULT_PDF_THEME, PDF_METRICS, PDF_PARTY_COLUMNS, type PdfTheme } from "./theme";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";
import type { DiscountType } from "@/generated/prisma/enums";

export type InvoicePdfProps = {
  invoiceNumber: string;
  variableSymbol: string;
  issuedAt: Date;
  dueDate: Date;
  currency: CurrencyCode;
  lang: PdfLang;
  hideItemPrices: boolean;
  discountType: DiscountType;
  supplier: {
    name: string;
    addressLines: string[];
    ico: string;
    dic: string;
    bankAccount: string;
    accountNumber: string;
    swiftBic: string;
    isVatPayer: boolean;
  };
  customer: { name: string; addressLines: string[]; ico: string; dic: string };
  items: { description: string; quantity: number; unitPrice: number; vatRate: number; category: string }[];
  total: number;
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  accentColor: string;
  /** Light (white page, default) or dark. */
  theme?: PdfTheme;
};

export function InvoicePdf({
  invoiceNumber,
  variableSymbol,
  issuedAt,
  dueDate,
  currency,
  lang,
  hideItemPrices,
  discountType,
  supplier,
  customer,
  items,
  total,
  qrDataUrl,
  logoDataUrl,
  accentColor,
  theme = DEFAULT_PDF_THEME,
}: InvoicePdfProps) {
  const t = pdfLabels(lang);
  const s = themedStyles(theme);
  const fontFamily = registerAppFont();
  const base = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const discountAmount = Math.round(base + vat) - total;
  const accent = accentColor || DEFAULT_ACCENT;
  const groups = groupItemsByCategory(items);
  const supplierIds = documentIds(supplier.ico, supplier.dic);
  const customerIds = documentIds(customer.ico, customer.dic);
  const cols = PDF_PARTY_COLUMNS.invoice;
  const M = PDF_METRICS;

  return (
    <Document>
      <Page size="A4" style={[s.page, { fontFamily }]}>
        <View style={s.headerRow}>
          <Text style={s.wordmark}>{t.invoice.toLowerCase()}</Text>
          <View style={s.headerSupplier}>
            {logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this renders to PDF, not the DOM
              <Image src={logoDataUrl} style={s.logoImage} />
            ) : (
              <View style={[s.initialChip, { backgroundColor: accent }]}>
                <Text style={s.initialChipText}>{supplier.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={s.headerSupplierName}>{supplier.name}</Text>
          </View>
        </View>

        <View style={s.bigDateRow}>
          <View style={s.bigDateStack}>
            <Text style={s.bigDateLine}>
              {t.issued} {date(issuedAt, lang)}
            </Text>
            <Text style={s.bigDateLine}>
              {t.due} {date(dueDate, lang)}
            </Text>
          </View>
          <Text style={s.bigDocNumber}>{invoiceNumber}</Text>
        </View>

        <View style={[s.partiesRow, { gap: cols.gap }]}>
          <View style={{ width: cols.widths[0] }}>
            <Text style={s.label}>{t.supplier}</Text>
            <Text style={s.partyName}>{supplier.name}</Text>
            {supplier.addressLines.map((line, i) => (
              <Text key={i} style={s.partyLine}>
                {line}
              </Text>
            ))}
            {supplierIds ? <Text style={[s.partyLine, { marginTop: M.idsMarginTop }]}>{supplierIds}</Text> : null}
            {!supplier.isVatPayer && <Text style={s.partyLine}>{t.notVatPayer}</Text>}
          </View>
          <View style={{ width: cols.widths[1] }}>
            <Text style={s.label}>{t.customer}</Text>
            <Text style={s.partyName}>{customer.name}</Text>
            {customer.addressLines.map((line, i) => (
              <Text key={i} style={s.partyLine}>
                {line}
              </Text>
            ))}
            {customerIds ? <Text style={[s.partyLine, { marginTop: M.idsMarginTop }]}>{customerIds}</Text> : null}
          </View>
          <View style={{ width: cols.widths[2] }}>
            <Text style={s.label}>{t.paymentDetails}</Text>
            {supplier.accountNumber ? (
              <Text style={s.partyLine}>
                {t.accountNumber} {supplier.accountNumber}
              </Text>
            ) : null}
            {supplier.bankAccount ? <Text style={s.partyLine}>{supplier.bankAccount}</Text> : null}
            {supplier.swiftBic ? (
              <Text style={s.partyLine}>
                {t.swift} {supplier.swiftBic}
              </Text>
            ) : null}
            <Text style={s.partyLine}>
              {t.variableSymbol} {variableSymbol}
            </Text>
          </View>
          <View style={{ width: cols.widths[3] }}>
            <Text style={s.label}>{t.qrPlatba}</Text>
            {qrDataUrl ? (
              <>
                <View style={s.qrBox}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this renders to PDF, not the DOM */}
                  <Image src={qrDataUrl} style={s.qrImage} />
                </View>
                <Text style={s.qrCaptionText}>{t.scanToPay}</Text>
              </>
            ) : (
              <Text style={s.qrCaptionText}>{currency !== "CZK" ? t.qrCzkOnly : t.noBankAccount}</Text>
            )}
          </View>
        </View>

        <View style={s.table}>
          {!hideItemPrices && (
            <View style={s.tableHeaderRow}>
              <Text style={[s.th, s.colDesc]}>{t.item}</Text>
              <Text style={[s.th, s.colQty]}>{t.qty}</Text>
              <Text style={[s.th, s.colUnit]}>{t.unit}</Text>
              <Text style={[s.th, s.colVat]}>{t.vat}</Text>
              <Text style={[s.th, s.colTotal]}>{t.total}</Text>
            </View>
          )}
          {groups.map((g, gi) => (
            <View key={gi}>
              {g.category ? <Text style={s.categoryLabel}>{g.category}</Text> : null}
              {g.items.map((item, i) =>
                hideItemPrices ? (
                  <Text key={i} style={[s.tableRowNoPrices, s.tableCell]}>
                    {item.description}
                  </Text>
                ) : (
                  <View key={i} style={s.tableRow}>
                    <Text style={[s.tableCell, s.colDesc]}>{item.description}</Text>
                    <Text style={[s.tableCell, s.colQty]}>{item.quantity}</Text>
                    <Text style={[s.tableCell, s.colUnit]}>{money(item.unitPrice, currency)}</Text>
                    <Text style={[s.tableCell, s.colVat]}>{item.vatRate}%</Text>
                    <Text style={[s.tableCell, s.colTotal]}>{money(item.quantity * item.unitPrice, currency)}</Text>
                  </View>
                )
              )}
              {hideItemPrices && g.category ? <Text style={s.categorySubtotal}>{money(categoryTotal(g.items), currency)}</Text> : null}
            </View>
          ))}
        </View>

        <View style={s.summaryRow}>
          <View style={s.summaryBlock}>
            <Text style={s.label}>{t.base}</Text>
            <Text style={s.summaryValue}>{money(base, currency)}</Text>
          </View>
          <View style={s.summaryBlock}>
            <Text style={s.label}>{t.vat}</Text>
            <Text style={s.summaryValue}>{money(vat, currency)}</Text>
          </View>
          {discountType !== "NONE" && discountAmount > 0 ? (
            <View style={s.summaryBlock}>
              <Text style={s.label}>{t.discount}</Text>
              <Text style={s.summaryValue}>-{money(discountAmount, currency)}</Text>
            </View>
          ) : null}
          <View style={s.summaryBlock}>
            <Text style={s.label}>{t.toPay}</Text>
            <Text style={[s.toPayValue, { color: accent }]}>{money(total, currency)}</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={s.footerRow}>
          <Text style={s.footerText}>{t.invoiceThanks}</Text>
        </View>
      </Page>
    </Document>
  );
}
