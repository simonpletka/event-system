import { requireUser, canViewFinance, canViewExpenses, quoteWhereForUser, invoiceWhereForUser, expenseWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getLocale, getDictionary } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { MobileStickyTabs } from "@/components/ui/MobileStickyTabs";
import { FinanceTabs } from "@/components/finance/FinanceTabs";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale);

  const canFinance = canViewFinance(user);
  const canExpenses = canViewExpenses(user);

  // Expenses-only roles (e.g. a Member) reach the Expenses sub-section but not
  // quotes/invoices/reports — those pages redirect, and the tabs below hide.
  if (!canFinance && !canExpenses) {
    return (
      <div>
        <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{t.finance.title}</h1>
        <p className="text-lg font-semibold text-ink">{t.finance.noAccess}</p>
      </div>
    );
  }

  const [quoteCount, invoiceCount, expenseCount] = await Promise.all([
    canFinance ? prisma.quote.count({ where: quoteWhereForUser(user) }) : Promise.resolve(0),
    canFinance ? prisma.invoice.count({ where: invoiceWhereForUser(user) }) : Promise.resolve(0),
    prisma.expense.count({ where: expenseWhereForUser(user) }),
  ]);

  return (
    <div>
      <PageHeader pb="pb-2">
        <div className="flex items-end justify-between">
          <div>
            <div className="heading-label">{t.finance.openDocs(quoteCount + invoiceCount + expenseCount)}</div>
            <h1 className="text-[60px] font-bold tracking-tight mt-1">{t.finance.title}</h1>
          </div>
        </div>
        <div className="hidden md:block mt-3">
          <FinanceTabs
            counts={{ quotes: quoteCount, invoices: invoiceCount, expenses: expenseCount }}
            locale={locale}
            canFinance={canFinance}
          />
        </div>
      </PageHeader>

      <MobileStickyTabs>
        <FinanceTabs
          counts={{ quotes: quoteCount, invoices: invoiceCount, expenses: expenseCount }}
          locale={locale}
          canFinance={canFinance}
        />
      </MobileStickyTabs>

      <div className="mt-4">{children}</div>
    </div>
  );
}
