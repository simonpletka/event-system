import { renderToBuffer } from "@react-pdf/renderer";
import type { getQuoteDetail, getCompanySettings } from "@/lib/queries/finance";
import { readLogoAsDataUrl } from "@/lib/uploads";
import { QuotePdf } from "@/lib/pdf/QuotePdf";
import type { PdfLang } from "@/lib/pdf/i18n";
import { addressLines, clientAddressLines } from "@/lib/pdf/shared";

type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>;
type Company = Awaited<ReturnType<typeof getCompanySettings>>;

/** Shared by the /api/quotes/[id]/pdf route and the Google Drive export action — same PDF either way. */
export async function buildQuotePdfBuffer(quote: QuoteDetail, company: Company, lang: PdfLang) {
  const supplier = company ?? { name: "Company", address: "", ico: "", dic: "", isVatPayer: true };
  const logoDataUrl = company?.logoPath ? await readLogoAsDataUrl(company.logoPath) : null;

  const client = quote.project.client;
  const customerAddressLines = client ? clientAddressLines(client) : addressLines(quote.project.companyAddress);

  return renderToBuffer(
    <QuotePdf
      quoteNumber={quote.number}
      issuedAt={quote.issuedAt}
      validUntil={quote.validUntil}
      currency={quote.currency}
      lang={lang}
      hideItemPrices={quote.hideItemPrices}
      supplier={{ ...supplier, addressLines: addressLines(supplier.address) }}
      customer={{
        name: quote.project.companyName,
        addressLines: customerAddressLines,
        ico: quote.project.companyIco,
        dic: quote.project.companyDic,
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
      createdBy={{ name: quote.createdBy.name, email: quote.createdBy.email, phone: quote.createdBy.phone }}
    />
  );
}
