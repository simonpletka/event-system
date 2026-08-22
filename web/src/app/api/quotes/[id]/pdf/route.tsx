import { requireUser } from "@/lib/authz";
import { getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { buildQuotePdfBuffer } from "@/lib/pdf/build-quote-pdf";
import type { PdfLang } from "@/lib/pdf/i18n";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lang: PdfLang = new URL(req.url).searchParams.get("lang") === "cs" ? "cs" : "en";

  const quote = await getQuoteDetail(user, id);
  if (!quote) return new Response("Not found", { status: 404 });

  const company = await getCompanySettings();
  const buffer = await buildQuotePdfBuffer(quote, company, lang);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${quote.number}.pdf"`,
    },
  });
}
