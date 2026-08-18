import { notFound } from "next/navigation";
import { requireUser, canManageFinance } from "@/lib/authz";
import { getQuoteDetail } from "@/lib/queries/finance";
import { getItemCategories } from "@/lib/actions/categories";
import { QuoteForm } from "@/components/finance/QuoteForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [quote, categoryRows] = await Promise.all([getQuoteDetail(user, id), getItemCategories()]);
  if (!quote) notFound();

  if (!canManageFinance(user) || quote.status !== "DRAFT") {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.quotes.editQuote}</h1>
        <p className="text-sm placeholder-text">
          {quote.status !== "DRAFT" ? t.finance.quotes.onlyDraftEditable : t.finance.quotes.noPermEdit}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.quotes.editQuoteN(quote.number)}</h1>
      <QuoteForm
        events={[]}
        categories={categoryRows.map((c) => c.name)}
        defaults={{
          id: quote.id,
          eventId: quote.eventId,
          status: quote.status,
          currency: quote.currency,
          validUntil: quote.validUntil,
          hideItemPrices: quote.hideItemPrices,
          items: quote.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            vatRate: i.vatRate,
            category: i.category,
          })),
        }}
        locale={locale}
      />
    </div>
  );
}
