import { requireUser, canViewFinance, quoteWhereForUser, invoiceWhereForUser, expenseWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getLocale, getDictionary } from "@/lib/i18n";
import { FinanceTabs } from "@/components/finance/FinanceTabs";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);

  if (!canViewFinance(user)) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.title}</h1>
        <p className="text-sm placeholder-text">{t.finance.noAccess}</p>
      </div>
    );
  }

  const [quoteCount, invoiceCount, expenseCount] = await Promise.all([
    prisma.quote.count({ where: quoteWhereForUser(user) }),
    prisma.invoice.count({ where: invoiceWhereForUser(user) }),
    prisma.expense.count({ where: expenseWhereForUser(user) }),
  ]);

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-6 mt-0 md:-mt-5 px-6 pt-5 pb-2 backdrop-blur-2xl bg-gradient-to-b from-bg/80 to-bg/50 border-b border-ink/10">
        <div className="flex items-end justify-between">
          <div>
            <div className="heading-label">{t.finance.openDocs(quoteCount + invoiceCount + expenseCount)}</div>
            <h1 className="text-[28px] font-bold tracking-tight mt-1">{t.finance.title}</h1>
          </div>
        </div>
        <div className="mt-3">
          <FinanceTabs counts={{ quotes: quoteCount, invoices: invoiceCount, expenses: expenseCount }} locale={locale} />
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
