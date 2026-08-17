import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { requireUser } from "@/lib/authz";
import { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { variableSymbolFor } from "@/lib/document-number";
import { buildQrPaymentString } from "@/lib/qr-payment";
import { InvoicePdf } from "@/lib/pdf/InvoicePdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

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

  let qrDataUrl: string | null = null;
  if (supplier.bankAccount) {
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
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
    },
  });
}
