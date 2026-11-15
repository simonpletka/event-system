import { requireUser } from "@/lib/authz";
import { getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { buildQuotePdfBuffer } from "@/lib/pdf/build-quote-pdf";
import type { PdfLang } from "@/lib/pdf/i18n";
import { parsePdfTheme } from "@/lib/pdf/theme";
import { quotePdfFilename } from "@/lib/pdf/filename";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const search = new URL(req.url).searchParams;
  const lang: PdfLang = search.get("lang") === "cs" ? "cs" : "en";
  // ?download=1 (the Download PDF buttons): save the file straight away;
  // otherwise the browser shows it (the phone "Download PDF" link).
  const disposition = search.get("download") === "1" ? "attachment" : "inline";
  // ?theme=dark for the dark variant; anything else (or nothing) is light.
  const theme = parsePdfTheme(search.get("theme"));

  const quote = await getQuoteDetail(user, id);
  if (!quote) return new Response("Not found", { status: 404 });

  const company = await getCompanySettings();
  const buffer = await buildQuotePdfBuffer(quote, company, lang, theme);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${quotePdfFilename(quote.number, quote.project.title, lang)}"`,
    },
  });
}
