import path from "path";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

const DEFAULT_ACCENT = "#ec3013";
const INK = "#201e1d";

// The built-in "Helvetica" standard font only covers WinAnsi (cp1252), which
// is missing ě/ř/ů/ď/ť/ň — real Czech diacritics were silently dropping from
// invoice PDFs (e.g. "Vojtěšská" -> "Vojtská"). Neue Regrade covers all of
// them, so it's registered here too, not just used for the web UI. Same file
// registered at both weights since it's the only style file kept on disk —
// react-pdf needs *a* match for `fontWeight: 700` or it throws.
const FONT_PATH = path.join(process.cwd(), "src/fonts/neue-regrade/NeueRegrade-Variable.ttf");
Font.register({
  family: "NeueRegrade",
  fonts: [
    { src: FONT_PATH, fontWeight: 400 },
    { src: FONT_PATH, fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: INK, fontFamily: "NeueRegrade" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  companyName: { fontSize: 14, fontWeight: 700 },
  invoiceLabel: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: "#666", textAlign: "right" },
  invoiceNumber: { fontSize: 13, fontWeight: 700, textAlign: "right" },
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

export type InvoicePdfProps = {
  invoiceNumber: string;
  variableSymbol: string;
  issuedAt: Date;
  dueDate: Date;
  supplier: { name: string; address: string; ico: string; dic: string; bankAccount: string; isVatPayer: boolean };
  customer: { name: string; address: string; ico: string; dic: string };
  items: { description: string; quantity: number; unitPrice: number; vatRate: number }[];
  qrDataUrl: string | null;
  logoDataUrl: string | null;
  accentColor: string;
};

function money(n: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(n) + " Kč";
}
function date(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function InvoicePdf({
  invoiceNumber,
  variableSymbol,
  issuedAt,
  dueDate,
  supplier,
  customer,
  items,
  qrDataUrl,
  logoDataUrl,
  accentColor,
}: InvoicePdfProps) {
  const base = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const total = base + vat;
  const accent = accentColor || DEFAULT_ACCENT;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this renders to PDF, not the DOM */}
            {logoDataUrl ? <Image src={logoDataUrl} style={styles.logoImage} /> : null}
            <Text style={styles.companyName}>{supplier.name}</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
          </View>
        </View>
        <View style={styles.rule} />

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.label}>Supplier</Text>
            <Text style={styles.partyName}>{supplier.name}</Text>
            <Text style={styles.partyLine}>{supplier.address}</Text>
            <Text style={styles.partyLine}>
              IČO {supplier.ico} · DIČ {supplier.dic}
            </Text>
            {supplier.bankAccount ? <Text style={styles.partyLine}>{supplier.bankAccount}</Text> : null}
            {!supplier.isVatPayer && <Text style={styles.partyLine}>Not a VAT payer</Text>}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.partyName}>{customer.name}</Text>
            <Text style={styles.partyLine}>{customer.address}</Text>
            <Text style={styles.partyLine}>
              IČO {customer.ico || "—"} · DIČ {customer.dic || "—"}
            </Text>
            <Text style={[styles.partyLine, { marginTop: 6 }]}>Issued {date(issuedAt)}</Text>
            <Text style={styles.partyLine}>Due {date(dueDate)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDesc]}>Item</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit</Text>
            <Text style={[styles.th, styles.colVat]}>VAT</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{money(item.unitPrice)}</Text>
              <Text style={styles.colVat}>{item.vatRate}%</Text>
              <Text style={styles.colTotal}>{money(item.quantity * item.unitPrice)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBlock}>
            <Text style={styles.label}>Base</Text>
            <Text style={styles.summaryValue}>{money(base)}</Text>
          </View>
          <View style={styles.summaryBlock}>
            <Text style={styles.label}>VAT</Text>
            <Text style={styles.summaryValue}>{money(vat)}</Text>
          </View>
          <View style={styles.summaryBlock}>
            <Text style={styles.label}>To pay</Text>
            <Text style={[styles.toPayValue, { color: accent }]}>{money(total)}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            Variable symbol {variableSymbol}
            {qrDataUrl ? " · scan to pay by QR" : " · no bank account on file, QR payment unavailable"}
          </Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this renders to PDF, not the DOM */}
          {qrDataUrl ? <Image src={qrDataUrl} style={styles.qrImage} /> : null}
        </View>
      </Page>
    </Document>
  );
}
