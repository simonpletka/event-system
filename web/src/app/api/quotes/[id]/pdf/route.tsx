import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/authz";
import { getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { readLogoAsDataUrl } from "@/lib/uploads";
import { QuotePdf } from "@/lib/pdf/QuotePdf";
import type { PdfLang } from "@/lib/pdf/i18n";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const lang: PdfLang = new URL(req.url).searchParams.get("lang") === "cs" ? "cs" : "en";

  const quote = await getQuoteDetail(user, id);
  if (!quote) return new Response("Not found", { status: 404 });

  const company = await getCompanySettings();
  const supplier = company ?? { name: "Company", address: "", ico: "", dic: "", isVatPayer: true };
  const logoDataUrl = company?.logoPath ? await readLogoAsDataUrl(company.logoPath) : null;

  const buffer = await renderToBuffer(
    <QuotePdf
      quoteNumber={quote.number}
      issuedAt={quote.issuedAt}
      validUntil={quote.validUntil}
      currency={quote.currency}
      lang={lang}
      hideItemPrices={quote.hideItemPrices}
      supplier={supplier}
      customer={{
        name: quote.event.companyName,
        address: quote.event.companyAddress,
        ico: quote.event.companyIco,
        dic: quote.event.companyDic,
      }}
      items={quote.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate,
        category: i.category,
      }))}
      logoDataUrl={logoDataUrl}
      accentColor={company?.accentColor || "#ec3013"}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${quote.number}.pdf"`,
    },
  });
}
