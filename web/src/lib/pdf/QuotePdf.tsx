import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import type { CurrencyCode } from "@/lib/format";
import { DEFAULT_ACCENT, sharedStyles as styles, money, pdfDate as date, registerAppFont } from "./shared";
import { pdfLabels, type PdfLang } from "./i18n";
import { groupItemsByCategory, categoryTotal } from "@/lib/line-items";

export type QuotePdfProps = {
  quoteNumber: string;
  issuedAt: Date;
  validUntil: Date;
  currency: CurrencyCode;
  lang: PdfLang;
  hideItemPrices: boolean;
  supplier: { name: string; addressLines: string[]; ico: string; dic: string; isVatPayer: boolean };
  customer: { name: string; addressLines: string[]; ico: string; dic: string };
  items: { description: string; quantity: number; unitPrice: number; vatRate: number; category: string }[];
  logoDataUrl: string | null;
  accentColor: string;
  createdBy: { name: string; email: string; phone: string };
};

export function QuotePdf({
  quoteNumber,
  issuedAt,
  validUntil,
  currency,
  lang,
  hideItemPrices,
  supplier,
  customer,
  items,
  logoDataUrl,
  accentColor,
  createdBy,
}: QuotePdfProps) {
  const t = pdfLabels(lang);
  const fontFamily = registerAppFont();
  const base = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const total = base + vat;
  const accent = accentColor || DEFAULT_ACCENT;
  const groups = groupItemsByCategory(items);

  return (
    <Document>
      <Page size="A4" style={[styles.page, { fontFamily }]}>
        <View style={styles.headerRow}>
          <Text style={styles.wordmark}>{t.quote.toLowerCase()}</Text>
          <View style={styles.headerSupplier}>
            {logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this renders to PDF, not the DOM
              <Image src={logoDataUrl} style={styles.logoImage} />
            ) : (
              <View style={[styles.initialChip, { backgroundColor: accent }]}>
                <Text style={styles.initialChipText}>{supplier.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.headerSupplierName}>{supplier.name}</Text>
          </View>
        </View>

        <View style={styles.bigDateRow}>
          <View style={styles.bigDateStack}>
            <Text style={styles.bigDateLine}>
              {t.issued} {date(issuedAt, lang)}
            </Text>
            <Text style={styles.bigDateLine}>
              {t.validUntil} {date(validUntil, lang)}
            </Text>
          </View>
          <Text style={styles.bigDocNumber}>{quoteNumber}</Text>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBlockWide}>
            <Text style={styles.label}>{t.supplier}</Text>
            <Text style={styles.partyName}>{supplier.name}</Text>
            {supplier.addressLines.map((line, i) => (
              <Text key={i} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            <Text style={[styles.partyLine, { marginTop: 3 }]}>
              IČO {supplier.ico} · DIČ {supplier.dic}
            </Text>
            {!supplier.isVatPayer && <Text style={styles.partyLine}>{t.notVatPayer}</Text>}
          </View>
          <View style={styles.partyBlockWide}>
            <Text style={styles.label}>{t.customer}</Text>
            <Text style={styles.partyName}>{customer.name}</Text>
            {customer.addressLines.map((line, i) => (
              <Text key={i} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            <Text style={[styles.partyLine, { marginTop: 3 }]}>
              IČO {customer.ico || "—"} · DIČ {customer.dic || "—"}
            </Text>
          </View>
          <View style={styles.partyBlockWide}>
            <Text style={styles.label}>{t.createdBy}</Text>
            <Text style={[styles.partyName, { fontSize: 13 }]}>{createdBy.name}</Text>
            {createdBy.email ? <Text style={[styles.partyLine, { fontSize: 10 }]}>{createdBy.email}</Text> : null}
            {createdBy.phone ? <Text style={[styles.partyLine, { fontSize: 10 }]}>{createdBy.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          {!hideItemPrices && (
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colDesc]}>{t.item}</Text>
              <Text style={[styles.th, styles.colQty]}>{t.qty}</Text>
              <Text style={[styles.th, styles.colUnit]}>{t.unit}</Text>
              <Text style={[styles.th, styles.colVat]}>{t.vat}</Text>
              <Text style={[styles.th, styles.colTotal]}>{t.total}</Text>
            </View>
          )}
          {groups.map((g, gi) => (
            <View key={gi}>
              {g.category ? <Text style={[styles.label, { marginTop: 6 }]}>{g.category}</Text> : null}
              {g.items.map((item, i) =>
                hideItemPrices ? (
                  <Text key={i} style={[styles.tableRow, { paddingVertical: 3 }]}>
                    {item.description}
                  </Text>
                ) : (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.colDesc}>{item.description}</Text>
                    <Text style={styles.colQty}>{item.quantity}</Text>
                    <Text style={styles.colUnit}>{money(item.unitPrice, currency)}</Text>
                    <Text style={styles.colVat}>{item.vatRate}%</Text>
                    <Text style={styles.colTotal}>{money(item.quantity * item.unitPrice, currency)}</Text>
                  </View>
                )
              )}
              {hideItemPrices && g.category ? (
                <Text style={{ fontSize: 9, fontWeight: 700, textAlign: "right" }}>
                  {money(categoryTotal(g.items), currency)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBlock}>
            <Text style={styles.label}>{t.base}</Text>
            <Text style={styles.summaryValue}>{money(base, currency)}</Text>
          </View>
          <View style={styles.summaryBlock}>
            <Text style={styles.label}>{t.vat}</Text>
            <Text style={styles.summaryValue}>{money(vat, currency)}</Text>
          </View>
          <View style={styles.summaryBlock}>
            <Text style={styles.label}>{t.total}</Text>
            <Text style={[styles.toPayValue, { color: accent }]}>{money(total, currency)}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t.quoteValidUntil(date(validUntil, lang))}</Text>
        </View>
      </Page>
    </Document>
  );
}
