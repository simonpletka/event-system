import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import type { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { variableSymbolFor } from "@/lib/document-number";
import { buildQrPaymentString } from "@/lib/qr-payment";
import { readLogoAsDataUrl } from "@/lib/uploads";
import { InvoicePdf } from "@/lib/pdf/InvoicePdf";
import type { PdfLang } from "@/lib/pdf/i18n";
import { addressLines, clientAddressLines } from "@/lib/pdf/shared";
import { buildIsdocXml } from "@/lib/isdoc";

type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;
type Company = Awaited<ReturnType<typeof getCompanySettings>>;

/** Shared by the /api/invoices/[id]/pdf route and the invoice-emailing actions — same PDF either way. */
export async function buildInvoicePdfBuffer(invoice: InvoiceDetail, company: Company, lang: PdfLang) {
  const supplier = company ?? {
    name: "Company",
    address: "",
    ico: "",
    dic: "",
    bankAccount: "",
    accountNumber: "",
    swiftBic: "",
    isVatPayer: true,
  };

  const logoDataUrl = company?.logoPath ? await readLogoAsDataUrl(company.logoPath) : null;

  let qrDataUrl: string | null = null;
  // Czech "QR Platba" is a CZK-domestic payment standard — generating one
  // for a foreign-currency invoice would be misleading, not just unhelpful.
  if (supplier.bankAccount && invoice.currency === "CZK") {
    const spd = buildQrPaymentString({
      iban: supplier.bankAccount,
      amount: invoice.total - invoice.amountPaid,
      variableSymbol: invoice.variableSymbol || variableSymbolFor(invoice.number),
      message: `Invoice ${invoice.number}`,
    });
    qrDataUrl = await QRCode.toDataURL(spd, { margin: 0 });
  }

  // The linked Client (if any) has a real structured address; the Event's
  // own embedded companyAddress — what every other screen actually reads
  // from — is just free text, so it's split on commas as a best-effort
  // approximation instead (see addressLines()).
  const client = invoice.event.client;
  const customerAddressLines = client ? clientAddressLines(client) : addressLines(invoice.event.companyAddress);

  return renderToBuffer(
    <InvoicePdf
      invoiceNumber={invoice.number}
      variableSymbol={invoice.variableSymbol || variableSymbolFor(invoice.number)}
      issuedAt={invoice.issuedAt}
      dueDate={invoice.dueDate}
      currency={invoice.currency}
      lang={lang}
      hideItemPrices={invoice.hideItemPrices}
      discountType={invoice.discountType}
      total={invoice.total}
      supplier={{ ...supplier, addressLines: addressLines(supplier.address) }}
      customer={{
        name: invoice.event.companyName,
        addressLines: customerAddressLines,
        ico: invoice.event.companyIco,
        dic: invoice.event.companyDic,
      }}
      items={invoice.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate,
        category: i.category,
      }))}
      qrDataUrl={qrDataUrl}
      logoDataUrl={logoDataUrl}
      accentColor={company?.accentColor || "#ec3013"}
    />
  ).then((pdfBytes) => embedIsdoc(pdfBytes, invoice, supplier));
}

/**
 * Embeds the invoice's ISDOC 6.0.2 XML as a named attachment inside the same
 * PDF file — one download, human-readable PDF and machine-readable ISDOC
 * together, the same pattern hybrid e-invoice formats (Factur-X/ZUGFeRD)
 * use. Never throws: a malformed ISDOC build (e.g. a genuinely broken IČO)
 * shouldn't block the actual PDF a client needs — falls back to the plain
 * PDF bytes and logs the failure server-side.
 */
async function embedIsdoc(
  pdfBytes: Uint8Array,
  invoice: InvoiceDetail,
  supplier: { name: string; address: string; ico: string; dic: string; bankAccount: string; accountNumber: string; swiftBic: string; isVatPayer: boolean }
): Promise<Buffer> {
  try {
    const [supplierStreet, supplierCity = ""] = addressLines(supplier.address);
    const client = invoice.event.client;
    const customerLines = client ? clientAddressLines(client) : addressLines(invoice.event.companyAddress);
    const [customerStreet, customerCity = ""] = customerLines;

    const xml = buildIsdocXml({
      number: invoice.number,
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      supplier: {
        name: supplier.name,
        ico: supplier.ico,
        dic: supplier.dic,
        street: supplierStreet ?? "",
        buildingNumber: "",
        city: supplierCity,
        postalZone: "",
      },
      customer: {
        name: invoice.event.companyName,
        ico: invoice.event.companyIco,
        dic: invoice.event.companyDic,
        street: customerStreet ?? "",
        buildingNumber: "",
        city: customerCity,
        postalZone: "",
      },
      items: invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate })),
      total: invoice.total,
      variableSymbol: invoice.variableSymbol || variableSymbolFor(invoice.number),
      bankAccountNumber: supplier.accountNumber,
      iban: supplier.bankAccount,
      bic: supplier.swiftBic,
      supplierIsVatPayer: supplier.isVatPayer,
    });

    const pdfDoc = await PDFDocument.load(pdfBytes);
    await pdfDoc.attach(Buffer.from(xml, "utf-8"), `${invoice.number}.isdoc`, {
      mimeType: "application/vnd.isdoc+xml",
      description: "ISDOC 6.0.2 structured invoice data",
      creationDate: new Date(),
      modificationDate: new Date(),
    });
    return Buffer.from(await pdfDoc.save());
  } catch (e) {
    console.error("Failed to embed ISDOC into invoice PDF", e);
    return Buffer.from(pdfBytes);
  }
}
