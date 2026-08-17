export type PdfLang = "en" | "cs";

export const PDF_LABELS = {
  en: {
    invoice: "Invoice",
    quote: "Quote",
    supplier: "Supplier",
    customer: "Customer",
    notVatPayer: "Not a VAT payer",
    item: "Item",
    qty: "Qty",
    unit: "Unit",
    vat: "VAT",
    total: "Total",
    base: "Base",
    toPay: "To pay",
    issued: "Issued",
    due: "Due",
    validUntil: "Valid until",
    variableSymbol: "Variable symbol",
    scanToPay: "scan to pay by QR",
    noBankAccount: "no bank account on file, QR payment unavailable",
    qrCzkOnly: "QR Platba is a CZK-only payment standard, not available for this invoice's currency",
    quoteValidUntil: (date: string) => `This quote is valid until ${date}.`,
  },
  cs: {
    invoice: "Faktura",
    quote: "Nabídka",
    supplier: "Dodavatel",
    customer: "Odběratel",
    notVatPayer: "Neplátce DPH",
    item: "Položka",
    qty: "Množ.",
    unit: "Jedn.",
    vat: "DPH",
    total: "Celkem",
    base: "Základ",
    toPay: "K úhradě",
    issued: "Vystaveno",
    due: "Splatnost",
    validUntil: "Platnost do",
    variableSymbol: "Variabilní symbol",
    scanToPay: "naskenujte QR kód pro platbu",
    noBankAccount: "není uveden bankovní účet, platba QR kódem není k dispozici",
    qrCzkOnly: "QR Platba funguje pouze v CZK, pro měnu této faktury není k dispozici",
    quoteValidUntil: (date: string) => `Tato nabídka je platná do ${date}.`,
  },
} as const;

export function pdfLabels(lang: PdfLang) {
  return PDF_LABELS[lang];
}
