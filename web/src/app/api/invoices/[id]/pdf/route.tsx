import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { requireUser } from "@/lib/authz";
import { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { variableSymbolFor } from "@/lib/document-number";
import { buildQrPaymentString } from "@/lib/qr-payment";
import { readLogoAsDataUrl } from "@/lib/uploads";
import { InvoicePdf } from "@/lib/pdf/InvoicePdf";
import type { PdfLang } from "@/lib/pdf/i18n";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lang: PdfLang = new URL(req.url).searchParams.get("lang") === "cs" ? "cs" : "en";

  const invoice = await getInvoiceDetail(user, id);
  if (!invoice) return new Response("Not found", { status: 404 });

  const company = await getCompanySettings();
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

  const buffer = await renderToBuffer(
    <InvoicePdf
      invoiceNumber={invoice.number}
      variableSymbol={invoice.variableSymbol || variableSymbolFor(invoice.number)}
      issuedAt={invoice.issuedAt}
      dueDate={invoice.dueDate}
      currency={invoice.currency}
      lang={lang}
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
      }))}
      qrDataUrl={qrDataUrl}
      logoDataUrl={logoDataUrl}
      accentColor={company?.accentColor || "#ec3013"}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
    },
  });
}
