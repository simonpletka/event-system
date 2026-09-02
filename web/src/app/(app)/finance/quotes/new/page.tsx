import { requireUser, canManageFinance, projectWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getItemCategories } from "@/lib/actions/categories";
import { QuoteForm } from "@/components/finance/QuoteForm";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  if (!canManageFinance(user)) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.quotes.newQuoteH1}</h1>
        <p className="text-lg font-semibold text-ink">{t.finance.quotes.noPermCreate}</p>
      </div>
    );
  }

  const [events, categoryRows] = await Promise.all([
    prisma.project.findMany({
      where: projectWhereForUser(user),
      select: { id: true, title: true, companyName: true, startDate: true },
      orderBy: { title: "asc" },
    }),
    getItemCategories(),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.quotes.newQuoteH1}</h1>
      <QuoteForm events={events} categories={categoryRows.map((c) => c.name)} initialEventId={params.projectId} locale={locale} />
    </div>
  );
}
