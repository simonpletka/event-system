import { renderToBuffer } from "@react-pdf/renderer";
import type { getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { readLogoAsDataUrl } from "@/lib/uploads";
import { QuotePdf } from "@/lib/pdf/QuotePdf";
import type { PdfLang } from "@/lib/pdf/i18n";

type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>;
type Company = Awaited<ReturnType<typeof getCompanySettings>>;

/** Shared by the /api/quotes/[id]/pdf route and the Google Drive export action — same PDF either way. */
export async function buildQuotePdfBuffer(quote: QuoteDetail, company: Company, lang: PdfLang) {
  const supplier = company ?? { name: "Company", address: "", ico: "", dic: "", isVatPayer: true };
  const logoDataUrl = company?.logoPath ? await readLogoAsDataUrl(company.logoPath) : null;

  return renderToBuffer(
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
}
