import { notFound } from "next/navigation";
import { requireUser, canManageFinance } from "@/lib/authz";
import { getQuoteDetail } from "@/lib/queries/finance";
import { getItemCategories } from "@/lib/actions/categories";
import { QuoteForm } from "@/components/finance/QuoteForm";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [quote, categoryRows] = await Promise.all([getQuoteDetail(user, id), getItemCategories()]);
  if (!quote) notFound();

  if (!canManageFinance(user) || quote.status !== "DRAFT") {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Edit quote</h1>
        <p className="text-sm placeholder-text">
          {quote.status !== "DRAFT" ? "Only draft quotes can be edited." : "You don't have permission to edit quotes."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Edit quote {quote.number}</h1>
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
      />
    </div>
  );
}
