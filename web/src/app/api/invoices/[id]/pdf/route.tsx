import { requireUser } from "@/lib/authz";
import { getInvoiceDetail, getCompanySettings } from "@/lib/queries/finance";
import { buildInvoicePdfBuffer } from "@/lib/pdf/build-invoice-pdf";
import type { PdfLang } from "@/lib/pdf/i18n";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lang: PdfLang = new URL(req.url).searchParams.get("lang") === "cs" ? "cs" : "en";

  const invoice = await getInvoiceDetail(user, id);
  if (!invoice) return new Response("Not found", { status: 404 });

  const company = await getCompanySettings();
  const buffer = await buildInvoicePdfBuffer(invoice, company, lang);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
    },
  });
}
