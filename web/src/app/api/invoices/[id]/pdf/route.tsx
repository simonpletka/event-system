import { requireUser } from "@/lib/authz";
import { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { buildInvoicePdfBuffer } from "@/lib/pdf/build-invoice-pdf";
import type { PdfLang } from "@/lib/pdf/i18n";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const search = new URL(req.url).searchParams;
  const lang: PdfLang = search.get("lang") === "cs" ? "cs" : "en";
  // ?download=1 (the Download PDF buttons): save the file straight away;
  // otherwise the browser shows it (the phone "Download PDF" link).
  const disposition = search.get("download") === "1" ? "attachment" : "inline";

  const invoice = await getInvoiceDetail(user, id);
  if (!invoice) return new Response("Not found", { status: 404 });

  const company = await getCompanySettings();
  const buffer = await buildInvoicePdfBuffer(invoice, company, lang);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="invoice-${invoice.number}.pdf"`,
    },
  });
}
