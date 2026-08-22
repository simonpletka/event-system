import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { variableSymbolFor } from "@/lib/document-number";
import { buildQrPaymentString } from "@/lib/qr-payment";
import { readLogoAsDataUrl } from "@/lib/uploads";
import { InvoicePdf } from "@/lib/pdf/InvoicePdf";
import type { PdfLang } from "@/lib/pdf/i18n";

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
      supplier={supplier}
      customer={{
        name: invoice.event.companyName,
        address: invoice.event.companyAddress,
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
  );
}
