import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import type { CurrencyCode } from "@/lib/format";
import { DEFAULT_ACCENT, sharedStyles as styles, money, pdfDate as date, registerAppFont } from "./shared";
import { pdfLabels, type PdfLang } from "./i18n";

export type QuotePdfProps = {
  quoteNumber: string;
  issuedAt: Date;
  validUntil: Date;
  currency: CurrencyCode;
  lang: PdfLang;
  supplier: { name: string; address: string; ico: string; dic: string; isVatPayer: boolean };
  customer: { name: string; address: string; ico: string; dic: string };
  items: { description: string; quantity: number; unitPrice: number; vatRate: number }[];
  logoDataUrl: string | null;
  accentColor: string;
};

export function QuotePdf({
  quoteNumber,
  issuedAt,
  validUntil,
  currency,
  lang,
  supplier,
  customer,
  items,
  logoDataUrl,
  accentColor,
}: QuotePdfProps) {
  const t = pdfLabels(lang);
  const fontFamily = registerAppFont();
  const base = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const total = base + vat;
  const accent = accentColor || DEFAULT_ACCENT;

  return (
    <Document>
      <Page size="A4" style={[styles.page, { fontFamily }]}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this renders to PDF, not the DOM */}
            {logoDataUrl ? <Image src={logoDataUrl} style={styles.logoImage} /> : null}
            <Text style={styles.companyName}>{supplier.name}</Text>
          </View>
          <View>
            <Text style={styles.docLabel}>{t.quote}</Text>
            <Text style={styles.docNumber}>{quoteNumber}</Text>
          </View>
        </View>
        <View style={styles.rule} />

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.label}>{t.supplier}</Text>
            <Text style={styles.partyName}>{supplier.name}</Text>
            <Text style={styles.partyLine}>{supplier.address}</Text>
            <Text style={styles.partyLine}>
              IČO {supplier.ico} · DIČ {supplier.dic}
            </Text>
            {!supplier.isVatPayer && <Text style={styles.partyLine}>{t.notVatPayer}</Text>}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.label}>{t.customer}</Text>
            <Text style={styles.partyName}>{customer.name}</Text>
            <Text style={styles.partyLine}>{customer.address}</Text>
            <Text style={styles.partyLine}>
              IČO {customer.ico || "—"} · DIČ {customer.dic || "—"}
            </Text>
            <Text style={[styles.partyLine, { marginTop: 6 }]}>
              {t.issued} {date(issuedAt, lang)}
            </Text>
            <Text style={styles.partyLine}>
              {t.validUntil} {date(validUntil, lang)}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDesc]}>{t.item}</Text>
            <Text style={[styles.th, styles.colQty]}>{t.qty}</Text>
            <Text style={[styles.th, styles.colUnit]}>{t.unit}</Text>
            <Text style={[styles.th, styles.colVat]}>{t.vat}</Text>
            <Text style={[styles.th, styles.colTotal]}>{t.total}</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{money(item.unitPrice, currency)}</Text>
              <Text style={styles.colVat}>{item.vatRate}%</Text>
              <Text style={styles.colTotal}>{money(item.quantity * item.unitPrice, currency)}</Text>
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
